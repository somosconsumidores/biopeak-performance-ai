import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyStravaSignature(rawBody: string, signature: string | null): Promise<boolean> {
  try {
    if (!signature) return false;
    // Support formats like "sha256=<hex>" or plain hex
    const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const secret = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';
    if (!secret) return false;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const expected = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return expected === provided.toLowerCase();
  } catch (_) {
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Create service role client for database operations
  const serviceRoleClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const url = new URL(req.url)
    
    // Handle Strava webhook verification (GET request)
    if (req.method === 'GET') {
      const hubMode = url.searchParams.get('hub.mode')
      const hubChallenge = url.searchParams.get('hub.challenge')
      const hubVerifyToken = url.searchParams.get('hub.verify_token')
      
      console.log('Strava webhook verification:', { hubMode, hubChallenge, hubVerifyToken })
      
      // Verify the token using secret from environment
      const expectedToken = Deno.env.get('STRAVA_VERIFY_TOKEN') ?? ''
      if (hubMode === 'subscribe' && expectedToken && hubVerifyToken === expectedToken) {
        console.log('Webhook verification successful')
        return new Response(JSON.stringify({ 'hub.challenge': hubChallenge }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else {
        console.log('Webhook verification failed')
        return new Response('Forbidden', { status: 403, headers: corsHeaders })
      }
    }

    // Handle webhook notifications (POST request)
    if (req.method === 'POST') {
      const signature = req.headers.get('X-Strava-Signature') || req.headers.get('x-strava-signature')
      const rawBody = await req.text()
      const valid = await verifyStravaSignature(rawBody, signature)
      if (!valid) {
        console.warn('Invalid Strava signature')
        try {
          const parsed = JSON.parse(rawBody)
          await serviceRoleClient
            .from('strava_webhook_logs')
            .insert({
              webhook_type: parsed?.aspect_type || 'unknown',
              payload: parsed,
              status: 'invalid_signature'
            })
        } catch (_) { /* ignore */ }
        return new Response('Invalid signature', { status: 401, headers: corsHeaders })
      }

      const payload = JSON.parse(rawBody)
      console.log('Strava webhook notification received (sanitized):', {
        aspect_type: payload.aspect_type,
        object_type: payload.object_type,
        object_id: payload.object_id
      })

      // Store webhook log
      await serviceRoleClient
        .from('strava_webhook_logs')
        .insert({
          webhook_type: payload.aspect_type || 'unknown',
          payload: payload,
          status: 'received'
        })

      // Process the webhook based on type
      if (payload.aspect_type === 'create' && payload.object_type === 'activity') {
        await handleActivityCreated(serviceRoleClient, payload)
      } else if (payload.aspect_type === 'update' && payload.object_type === 'activity') {
        await handleActivityUpdated(serviceRoleClient, payload)
      } else if (payload.aspect_type === 'delete' && payload.object_type === 'activity') {
        await handleActivityDeleted(serviceRoleClient, payload)
      }

      return new Response('OK', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    return new Response('Method not allowed', { status: 405 })

  } catch (error) {
    console.error('Strava webhook error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Handle new activity creation
async function handleActivityCreated(serviceRoleClient: any, payload: any) {
  console.log('Processing new activity creation:', payload.object_id)
  
  try {
    // Find user by athlete ID with token expiration data
    // Convert to number to handle scientific notation in database
    const { data: userData } = await serviceRoleClient
      .from('strava_tokens')
      .select('user_id, access_token, refresh_token, expires_at')
      .eq('athlete_id', Number(payload.owner_id))
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!userData) {
      console.log('No user found for athlete ID:', payload.owner_id)
      return
    }

    let accessToken = userData.access_token;

    // Check if token is expired and refresh if needed
    if (userData.expires_at) {
      const expiresAt = new Date(userData.expires_at);
      const now = new Date();
      
      if (expiresAt <= now) {
        console.log('Token expired, refreshing for user:', userData.user_id);
        accessToken = await refreshStravaToken(serviceRoleClient, userData);
      }
    }

    // Fetch activity details directly from Strava API
    let activityResponse = await fetch(`https://www.strava.com/api/v3/activities/${payload.object_id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    // If we get 401, try refreshing token once more
    if (!activityResponse.ok && activityResponse.status === 401 && userData.refresh_token) {
      console.log('Got 401, attempting token refresh for user:', userData.user_id);
      accessToken = await refreshStravaToken(serviceRoleClient, userData);
      
      // Retry the API call with new token
      activityResponse = await fetch(`https://www.strava.com/api/v3/activities/${payload.object_id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
    }

    if (!activityResponse.ok) {
      throw new Error(`Strava API error: ${activityResponse.status} ${activityResponse.statusText}`)
    }

    const activityData = await activityResponse.json()
    console.log('Fetched activity data from Strava:', activityData.id)

    // Insert activity into strava_activities table
    const { error: insertError } = await serviceRoleClient
      .from('strava_activities')
      .upsert({
        user_id: userData.user_id,
        strava_activity_id: activityData.id,
        name: activityData.name,
        type: activityData.type,
        start_date: activityData.start_date,
        distance: activityData.distance,
        moving_time: activityData.moving_time,
        elapsed_time: activityData.elapsed_time,
        total_elevation_gain: activityData.total_elevation_gain,
        average_speed: activityData.average_speed,
        max_speed: activityData.max_speed,
        average_heartrate: activityData.average_heartrate,
        max_heartrate: activityData.max_heartrate,
        calories: activityData.calories
      }, {
        onConflict: 'user_id,strava_activity_id'
      })

    if (insertError) {
      throw new Error(`Database insert error: ${insertError.message}`)
    }

    console.log('Successfully processed and stored activity:', payload.object_id)

    // Fetch activity streams automatically
    try {
      console.log('Fetching activity streams for activity:', payload.object_id)
      
      const streamsResponse = await serviceRoleClient.functions.invoke('strava-activity-streams', {
        body: { 
          activity_id: payload.object_id,
          user_id: userData.user_id,
          access_token: accessToken,
          internal_call: true
        }
      })

      if (streamsResponse.error) {
        console.error('Error fetching activity streams:', streamsResponse.error)
      } else {
        console.log('Successfully fetched activity streams for:', payload.object_id)
      }
    } catch (streamsError) {
      console.error('Failed to call activity streams function:', streamsError)
    }

    // Update webhook log
    await serviceRoleClient
      .from('strava_webhook_logs')
      .update({
        user_id: userData.user_id,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('payload->object_id', payload.object_id)

  } catch (error) {
    console.error('Error handling activity creation:', error)
    
    // Update webhook log with error
    await serviceRoleClient
      .from('strava_webhook_logs')
      .update({
        status: 'error',
        error_message: error?.message,
        processed_at: new Date().toISOString()
      })
      .eq('payload->object_id', payload.object_id)
  }
}

// Handle activity updates
async function handleActivityUpdated(serviceRoleClient: any, payload: any) {
  console.log('Processing activity update:', payload.object_id)
  
  // Use same logic as creation to fetch and update the activity
  await handleActivityCreated(serviceRoleClient, payload)
}

// Handle activity deletions
async function handleActivityDeleted(serviceRoleClient: any, payload: any) {
  console.log('Processing activity deletion:', payload.object_id)
  
  try {
    // Find and delete the activity from our database
    const { error: deleteError } = await serviceRoleClient
      .from('strava_activities')
      .delete()
      .eq('strava_activity_id', payload.object_id)

    if (deleteError) {
      console.error('Failed to delete activity:', deleteError)
    } else {
      console.log('Successfully deleted activity:', payload.object_id)
    }

    // Update webhook log
    await serviceRoleClient
      .from('strava_webhook_logs')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('payload->object_id', payload.object_id)

  } catch (error) {
    console.error('Error handling activity deletion:', error)
    
    // Update webhook log with error
    await serviceRoleClient
      .from('strava_webhook_logs')
      .update({
        status: 'error',
        error_message: error?.message,
        processed_at: new Date().toISOString()
      })
      .eq('payload->object_id', payload.object_id)
   }
}

// Helper function to refresh Strava token
async function refreshStravaToken(serviceRoleClient: any, userData: any): Promise<string> {
  try {
    const refreshResponse = await serviceRoleClient.functions.invoke('strava-token-refresh', {
      body: {
        refresh_token: userData.refresh_token,
        user_id: userData.user_id
      }
    });

    if (refreshResponse.error || !refreshResponse.data?.success) {
      throw new Error(`Token refresh failed: ${refreshResponse.error?.message || 'Unknown error'}`);
    }

    console.log('Successfully refreshed token for user:', userData.user_id);
    return refreshResponse.data.access_token;
  } catch (refreshError) {
    console.error('Failed to refresh token:', refreshError);
    throw new Error(`Token refresh failed: ${refreshError.message}`);
  }
}