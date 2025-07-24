
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookRegistration {
  webhookId: number;
  webhookType: string;
  callbackUrl: string;
  eventTypes: string[];
}

Deno.serve(async (req) => {
  console.log(`[register-garmin-webhooks] ${req.method} ${req.url}`)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get user session
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      console.error('[register-garmin-webhooks] User authentication failed:', userError)
      throw new Error('User authentication failed')
    }

    console.log(`[register-garmin-webhooks] Processing webhook registration for user: ${user.id}`)

    // Get user's Garmin tokens
    const { data: garminTokens, error: tokenError } = await supabaseClient
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (tokenError || !garminTokens) {
      console.error('[register-garmin-webhooks] No active Garmin tokens found:', tokenError)
      throw new Error('No active Garmin tokens found')
    }

    console.log(`[register-garmin-webhooks] Found Garmin tokens for user: ${user.id}`)

    // Get Garmin OAuth credentials
    const GARMIN_CLIENT_ID = Deno.env.get('GARMIN_CLIENT_ID')
    const GARMIN_CLIENT_SECRET = Deno.env.get('GARMIN_CLIENT_SECRET')

    if (!GARMIN_CLIENT_ID || !GARMIN_CLIENT_SECRET) {
      throw new Error('Missing Garmin OAuth credentials')
    }

    // Base URLs for webhooks
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '') || 'https://grcwlmltlcltmwbhdpky.supabase.co'
    
    // Define webhooks to register
    const webhooks = [
      {
        type: 'activities',
        callbackUrl: `${baseUrl}/functions/v1/garmin-activities-webhook`,
        eventTypes: ['ACTIVITY_CREATED', 'ACTIVITY_UPDATED']
      },
      {
        type: 'activity-details',
        callbackUrl: `${baseUrl}/functions/v1/garmin-activity-details-webhook`,
        eventTypes: ['ACTIVITY_DETAILS_CREATED']
      },
      {
        type: 'deregistration',
        callbackUrl: `${baseUrl}/functions/v1/garmin-deregistration`,
        eventTypes: ['DEREGISTRATION']
      },
      {
        type: 'ping',
        callbackUrl: `${baseUrl}/functions/v1/garmin-ping-webhook`,
        eventTypes: ['PING']
      }
    ]

    const registrationResults = []

    // Register each webhook
    for (const webhook of webhooks) {
      try {
        console.log(`[register-garmin-webhooks] Registering ${webhook.type} webhook`)
        
        const webhookPayload = {
          webhookType: webhook.type.toUpperCase(),
          callbackUrl: webhook.callbackUrl,
          eventTypes: webhook.eventTypes
        }

        console.log(`[register-garmin-webhooks] Webhook payload:`, webhookPayload)

        // Create OAuth 1.0 authorization header
        const oauthHeader = `OAuth oauth_consumer_key="${GARMIN_CLIENT_ID}", oauth_token="${garminTokens.access_token}", oauth_signature_method="PLAINTEXT", oauth_signature="${GARMIN_CLIENT_SECRET}&${garminTokens.token_secret || ''}", oauth_timestamp="${Math.floor(Date.now() / 1000)}", oauth_nonce="${Math.random().toString(36).substring(7)}"`

        const response = await fetch('https://apis.garmin.com/wellness-api/rest/webhooks', {
          method: 'POST',
          headers: {
            'Authorization': oauthHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhookPayload)
        })

        const responseText = await response.text()
        console.log(`[register-garmin-webhooks] ${webhook.type} webhook response:`, response.status, responseText)

        if (!response.ok) {
          console.error(`[register-garmin-webhooks] Failed to register ${webhook.type} webhook:`, response.status, responseText)
          registrationResults.push({
            type: webhook.type,
            status: 'failed',
            error: `${response.status} - ${responseText}`
          })
          continue
        }

        let responseData
        try {
          responseData = JSON.parse(responseText)
        } catch (parseError) {
          console.warn(`[register-garmin-webhooks] Could not parse ${webhook.type} response as JSON:`, responseText)
          responseData = { rawResponse: responseText }
        }

        registrationResults.push({
          type: webhook.type,
          status: 'success',
          webhookId: responseData.webhookId,
          callbackUrl: webhook.callbackUrl
        })

        console.log(`[register-garmin-webhooks] Successfully registered ${webhook.type} webhook`)

      } catch (error) {
        console.error(`[register-garmin-webhooks] Error registering ${webhook.type} webhook:`, error)
        registrationResults.push({
          type: webhook.type,
          status: 'error',
          error: error.message
        })
      }
    }

    // Log webhook registration results
    try {
      await supabaseClient
        .from('garmin_webhook_logs')
        .insert({
          user_id: user.id,
          webhook_type: 'registration',
          payload: { results: registrationResults },
          status: 'completed',
          garmin_user_id: garminTokens.garmin_user_id
        })
    } catch (logError) {
      console.warn('[register-garmin-webhooks] Failed to log webhook registration:', logError)
    }

    // Check if all webhooks were registered successfully
    const successCount = registrationResults.filter(r => r.status === 'success').length
    const failedCount = registrationResults.filter(r => r.status === 'failed' || r.status === 'error').length

    console.log(`[register-garmin-webhooks] Registration complete: ${successCount} successful, ${failedCount} failed`)

    return new Response(JSON.stringify({
      success: successCount > 0,
      registered: successCount,
      failed: failedCount,
      results: registrationResults,
      message: successCount === webhooks.length 
        ? 'All webhooks registered successfully' 
        : `${successCount}/${webhooks.length} webhooks registered successfully`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[register-garmin-webhooks] Error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
