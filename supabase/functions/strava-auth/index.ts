import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: {
    id: number
    firstname: string
    lastname: string
  }
}

Deno.serve(async (req) => {
  console.log('🔵 Strava Auth - Received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔵 Strava Auth - Handling CORS preflight')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse request body
    console.log('🔵 Strava Auth - Parsing request body')
    const requestBody = await req.json()
    const { code, state } = requestBody
    console.log('🔵 Strava Auth - Request data:', { 
      hasCode: !!code, 
      hasState: !!state
    })
    
    if (!code || !state) {
      console.log('❌ Strava Auth - Missing required parameters:', { hasCode: !!code, hasState: !!state })
      return new Response(JSON.stringify({ error: 'Code and state required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extrair user_id do state (formato: userId:timestamp)
    const [userId, timestamp] = state.split(':')
    
    if (!userId || !timestamp) {
      console.log('❌ Strava Auth - Invalid state format:', state)
      return new Response(JSON.stringify({ error: 'Invalid state format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validar timestamp (máximo 10 minutos)
    const now = Date.now()
    const stateTimestamp = parseInt(timestamp)
    const tenMinutes = 10 * 60 * 1000
    
    if (now - stateTimestamp > tenMinutes) {
      console.log('❌ Strava Auth - State expired:', { 
        now, 
        stateTimestamp, 
        diff: now - stateTimestamp 
      })
      return new Response(JSON.stringify({ error: 'State expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log('✅ Strava Auth - State validated:', { 
      userId: userId.substring(0, 8) + '...', 
      timestamp 
    })

    // Exchange authorization code for access token
    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
    console.log('🔵 Strava Auth - Credentials check:', { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret 
    })
    
    if (!clientId || !clientSecret) {
      console.log('❌ Strava Auth - Missing Strava credentials')
      return new Response(JSON.stringify({ 
        error: 'Strava credentials not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log('🔵 Strava Auth - Exchanging code for tokens')
    const tokenPayload = {
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code'
    }
    console.log('🔵 Strava Auth - Token request payload:', { 
      ...tokenPayload, 
      client_secret: '[REDACTED]' 
    })

    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(tokenPayload),
    })

    console.log('🔵 Strava Auth - Token response status:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.log('❌ Strava Auth - Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      })
      return new Response(JSON.stringify({ 
        error: 'Failed to exchange authorization code',
        details: errorText
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokenData: StravaTokenResponse = await tokenResponse.json()
    console.log('✅ Strava Auth - Tokens received:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      athleteId: tokenData.athlete?.id
    })
    
    // Store tokens in database using SERVICE_ROLE_KEY
    console.log('🔵 Strava Auth - Storing tokens in database')
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const tokenRecord = {
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
      athlete_id: tokenData.athlete?.id,
    }
    console.log('🔵 Strava Auth - Token record:', {
      userId: tokenRecord.user_id.substring(0, 8) + '...',
      hasAccessToken: !!tokenRecord.access_token,
      hasRefreshToken: !!tokenRecord.refresh_token,
      expiresAt: tokenRecord.expires_at,
      athleteId: tokenRecord.athlete_id
    })
    
    // Delete existing tokens for this user first to avoid duplicates
    await serviceRoleClient
      .from('strava_tokens')
      .delete()
      .eq('user_id', userId)
    
    // Insert new token
    const { error: insertError } = await serviceRoleClient
      .from('strava_tokens')
      .insert(tokenRecord)

    if (insertError) {
      console.log('❌ Strava Auth - Failed to store tokens:', {
        error: insertError.message,
        code: insertError.code,
        details: insertError.details
      })
      return new Response(JSON.stringify({ 
        error: 'Failed to store tokens', 
        details: insertError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('✅ Strava Auth - Tokens stored successfully')
    
    // 🔥 Trigger background sync (fire-and-forget)
    console.log('🔵 Strava Auth - Triggering background sync...')
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/strava-sync-background`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    }).catch(error => {
      console.error('⚠️ Strava Auth - Failed to trigger background sync:', error);
      // Don't block the flow if this fails
    });
    
    console.log('✅ Strava Auth - Background sync scheduled')
    
    return new Response(JSON.stringify({ 
      success: true,
      athlete: tokenData.athlete 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.log('❌ Strava Auth - Unexpected error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})