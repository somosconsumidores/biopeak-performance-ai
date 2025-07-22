
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log(`Received ping webhook: ${req.method} from ${req.headers.get('user-agent')}`)

    // Log the ping for monitoring
    const pingData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    }

    // Try to get request body if present (some pings might include data)
    let payload = null
    try {
      if (req.headers.get('content-length') && parseInt(req.headers.get('content-length') || '0') > 0) {
        payload = await req.json()
        console.log('Ping payload received:', payload)
      }
    } catch (error) {
      // Ignore JSON parsing errors for ping requests
      console.log('No JSON payload in ping request')
    }

    // Log the ping to webhook_logs for monitoring
    await supabaseClient
      .from('garmin_webhook_logs')
      .insert({
        user_id: null, // Pings are not user-specific
        webhook_type: 'ping',
        payload: { ...pingData, requestPayload: payload },
        status: 'received',
        garmin_user_id: null
      })

    console.log('Ping webhook processed successfully')

    // Return immediate success response to Garmin
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Ping received successfully',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in ping webhook:', error)
    
    // Still return success to Garmin to avoid unanswered pings
    // The error is logged but we don't want to fail the ping
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Ping acknowledged',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
