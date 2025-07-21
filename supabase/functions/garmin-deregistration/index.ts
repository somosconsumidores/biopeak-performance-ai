import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeregistrationPayload {
  deregistrations: Array<{
    userId: string;
  }>;
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

    const payload: DeregistrationPayload = await req.json()
    console.log('Received deregistration payload:', payload)

    if (!payload.deregistrations || !Array.isArray(payload.deregistrations)) {
      console.error('Invalid payload structure')
      return new Response('Invalid payload', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const results = []

    for (const deregistration of payload.deregistrations) {
      const { userId: garminUserId } = deregistration
      
      try {
        console.log(`Processing deregistration for Garmin user: ${garminUserId}`)

        // Find and deactivate user tokens
        const { data: tokens, error: tokenError } = await supabaseClient
          .from('garmin_tokens')
          .select('user_id')
          .or(`token_secret.ilike.%${garminUserId}%,consumer_key.eq.${garminUserId}`)
          .eq('is_active', true)

        if (tokenError) {
          console.error('Error finding tokens:', tokenError)
          throw tokenError
        }

        if (tokens && tokens.length > 0) {
          // Deactivate tokens using the database function
          const { error: deactivateError } = await supabaseClient
            .rpc('deactivate_garmin_user', { garmin_user_id_param: garminUserId })

          if (deactivateError) {
            console.error('Error deactivating user:', deactivateError)
            throw deactivateError
          }

          // Log the webhook
          for (const token of tokens) {
            await supabaseClient
              .from('garmin_webhook_logs')
              .insert({
                user_id: token.user_id,
                webhook_type: 'deregistration',
                payload: deregistration,
                status: 'success',
                garmin_user_id: garminUserId
              })
          }

          console.log(`Successfully deactivated tokens for user: ${garminUserId}`)
          results.push({ userId: garminUserId, status: 'success' })
        } else {
          console.log(`No active tokens found for Garmin user: ${garminUserId}`)
          
          // Still log the webhook attempt
          await supabaseClient
            .from('garmin_webhook_logs')
            .insert({
              user_id: null,
              webhook_type: 'deregistration',
              payload: deregistration,
              status: 'no_user_found',
              garmin_user_id: garminUserId
            })

          results.push({ userId: garminUserId, status: 'no_user_found' })
        }
      } catch (error) {
        console.error(`Error processing deregistration for ${garminUserId}:`, error)
        
        // Log the error
        await supabaseClient
          .from('garmin_webhook_logs')
          .insert({
            user_id: null,
            webhook_type: 'deregistration',
            payload: deregistration,
            status: 'error',
            error_message: error.message,
            garmin_user_id: garminUserId
          })

        results.push({ userId: garminUserId, status: 'error', error: error.message })
      }
    }

    console.log('Deregistration processing complete:', results)

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in deregistration webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})