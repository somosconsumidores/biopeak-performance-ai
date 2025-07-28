import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Create supabase client with anon key for JWT validation
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )
  
  // Create service role client for database operations
  const serviceRoleClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user's Strava token
    const { data: tokenData } = await serviceRoleClient
      .from('strava_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!tokenData?.access_token) {
      return new Response(JSON.stringify({ 
        error: 'No Strava token found',
        details: 'User needs to connect to Strava first'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch activities from Strava
    const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    })

    if (!activitiesResponse.ok) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch Strava activities',
        details: `Status: ${activitiesResponse.status}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const activities = await activitiesResponse.json()

    // Store activities in database
    let syncedCount = 0
    for (const activity of activities) {
      const { error: insertError } = await serviceRoleClient
        .from('strava_activities')
        .upsert({
          user_id: user.id,
          strava_activity_id: activity.id,
          name: activity.name,
          type: activity.type,
          distance: activity.distance,
          moving_time: activity.moving_time,
          elapsed_time: activity.elapsed_time,
          total_elevation_gain: activity.total_elevation_gain,
          start_date: activity.start_date,
          calories: activity.calories,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          average_speed: activity.average_speed,
          max_speed: activity.max_speed,
        })

      if (!insertError) {
        syncedCount++
      }
    }

    // Update sync status
    await serviceRoleClient
      .from('strava_sync_status')
      .upsert({
        user_id: user.id,
        sync_status: 'completed',
        last_sync_at: new Date().toISOString(),
        total_activities_synced: syncedCount,
        last_activity_date: activities[0]?.start_date || null,
      })

    return new Response(JSON.stringify({ 
      success: true,
      synced: syncedCount,
      total: activities.length,
      message: `Successfully synced ${syncedCount} activities`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})