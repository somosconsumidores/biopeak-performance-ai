import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

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

    // Check if user is admin
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!userRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stravaClientId = Deno.env.get('STRAVA_CLIENT_ID')
    const stravaClientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')

    if (!stravaClientId || !stravaClientSecret || !supabaseUrl) {
      return new Response(JSON.stringify({ 
        error: 'Missing required environment variables',
        details: 'STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and SUPABASE_URL are required'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Construct the callback URL
    const callbackUrl = `${supabaseUrl}/functions/v1/strava-webhook`
    const verifyToken = 'biopeak-strava-webhook-2025'

    console.log('Registering Strava webhook with:', {
      client_id: stravaClientId,
      callback_url: callbackUrl,
      verify_token: verifyToken
    })

    // Register webhook with Strava
    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken
      })
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Strava webhook registration failed:', responseData)
      return new Response(JSON.stringify({ 
        error: 'Failed to register webhook',
        details: responseData,
        status: response.status
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Strava webhook registered successfully:', responseData)

    return new Response(JSON.stringify({ 
      success: true,
      subscription: responseData,
      callback_url: callbackUrl,
      verify_token: verifyToken
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Webhook registration error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})