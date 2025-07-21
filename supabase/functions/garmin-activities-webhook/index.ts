import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityNotification {
  userId: string;
  userAccessToken: string;
  summaryId: string;
  startTimeInSeconds: number;
  startTimeOffsetInSeconds?: number;
  activityType?: string;
  manual?: boolean;
  uploadTime?: number;
  callbackURL?: string;
}

interface ActivitiesPayload {
  activities?: ActivityNotification[];
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

    const payload: ActivitiesPayload = await req.json()
    console.log('Received activities webhook payload:', payload)

    // Handle both PING and PUSH webhook formats
    const activities = payload.activities || []
    
    if (!Array.isArray(activities)) {
      console.error('Invalid payload structure - activities should be an array')
      return new Response('Invalid payload', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const results = []

    for (const activity of activities) {
      const { userId: garminUserId, summaryId, startTimeInSeconds, activityType } = activity
      
      try {
        console.log(`Processing activity notification for Garmin user: ${garminUserId}, activity: ${summaryId}`)

        // Find user tokens
        const { data: tokens, error: tokenError } = await supabaseClient
          .from('garmin_tokens')
          .select('user_id, access_token, is_active')
          .or(`token_secret.ilike.%${garminUserId}%,consumer_key.eq.${garminUserId}`)
          .eq('is_active', true)

        if (tokenError) {
          console.error('Error finding tokens:', tokenError)
          throw tokenError
        }

        if (tokens && tokens.length > 0) {
          // Log the webhook for each active user
          for (const token of tokens) {
            await supabaseClient
              .from('garmin_webhook_logs')
              .insert({
                user_id: token.user_id,
                webhook_type: 'activity_notification',
                payload: activity,
                status: 'received',
                garmin_user_id: garminUserId
              })

            // Trigger sync for this specific user's activities
            // This is a webhook PING, so we initiate sync using callback URL if available
            try {
              console.log(`Triggering activity sync for user: ${token.user_id}`)
              
              // Use callbackURL from webhook if available, otherwise standard endpoint
              const apiUrl = activity.callbackURL || `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-garmin-activities`;
              
              const syncResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token.access_token}`,
                },
                body: JSON.stringify({
                  webhook_triggered: true,
                  callback_url: activity.callbackURL,
                  webhook_payload: activity,
                  timeRange: 'last_24_hours'
                })
              })

              if (syncResponse.ok) {
                console.log(`Successfully triggered sync for user: ${token.user_id}`)
                
                // Update webhook log status
                await supabaseClient
                  .from('garmin_webhook_logs')
                  .update({ status: 'sync_triggered' })
                  .eq('user_id', token.user_id)
                  .eq('webhook_type', 'activity_notification')
                  .eq('garmin_user_id', garminUserId)
                  .order('created_at', { ascending: false })
                  .limit(1)

              } else {
                console.error(`Failed to trigger sync for user: ${token.user_id}`, await syncResponse.text())
              }
            } catch (syncError) {
              console.error(`Error triggering sync for user ${token.user_id}:`, syncError)
            }
          }

          console.log(`Successfully processed activity notification for user: ${garminUserId}`)
          results.push({ 
            userId: garminUserId, 
            summaryId,
            status: 'success',
            activityType,
            usersNotified: tokens.length
          })
        } else {
          console.log(`No active tokens found for Garmin user: ${garminUserId}`)
          
          // Still log the webhook attempt
          await supabaseClient
            .from('garmin_webhook_logs')
            .insert({
              user_id: null,
              webhook_type: 'activity_notification',
              payload: activity,
              status: 'no_active_user',
              garmin_user_id: garminUserId
            })

          results.push({ userId: garminUserId, summaryId, status: 'no_active_user' })
        }
      } catch (error) {
        console.error(`Error processing activity notification for ${garminUserId}:`, error)
        
        // Log the error
        await supabaseClient
          .from('garmin_webhook_logs')
          .insert({
            user_id: null,
            webhook_type: 'activity_notification',
            payload: activity,
            status: 'error',
            error_message: error.message,
            garmin_user_id: garminUserId
          })

        results.push({ 
          userId: garminUserId, 
          summaryId: activity.summaryId, 
          status: 'error', 
          error: error.message 
        })
      }
    }

    console.log('Activity webhook processing complete:', results)

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in activities webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})