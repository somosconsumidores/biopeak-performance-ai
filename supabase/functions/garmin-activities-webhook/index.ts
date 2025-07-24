
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Always return success to Garmin within 3 seconds - critical for webhook health
  const successResponse = (results: any[] = []) => new Response(JSON.stringify({ 
    success: true, 
    results,
    timestamp: new Date().toISOString(),
    processingTime: Date.now() - startTime
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    console.log(`[garmin-activities-webhook] ${req.method} ${req.url}`);

    // Initialize Supabase client
    let supabaseClient;
    try {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
    } catch (clientError) {
      console.error('[garmin-activities-webhook] Failed to initialize Supabase client:', clientError);
      return successResponse([{ error: 'Service initialization failed', status: 'error' }]);
    }

    // Parse payload with robust error handling
    let payload: ActivitiesPayload = { activities: [] };
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        console.log('[garmin-activities-webhook] Empty payload received (ping)');
        return successResponse([{ status: 'ping_received' }]);
      }
      
      payload = JSON.parse(text);
      console.log('[garmin-activities-webhook] Received payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('[garmin-activities-webhook] Failed to parse payload:', parseError);
      return successResponse([{ error: 'Invalid JSON payload', status: 'error' }]);
    }

    // Handle PING requests or empty activities gracefully
    const activities = payload.activities || [];
    
    if (!Array.isArray(activities)) {
      console.log('[garmin-activities-webhook] Invalid payload structure - treating as ping');
      return successResponse([{ status: 'ping_received' }]);
    }

    if (activities.length === 0) {
      console.log('[garmin-activities-webhook] Empty activities array - treating as ping');
      return successResponse([{ status: 'ping_received' }]);
    }

    // Process activities asynchronously without blocking response
    const processActivities = async () => {
      const results = [];
      
      for (const activity of activities) {
        const { userId: garminUserId, summaryId, startTimeInSeconds, activityType } = activity;
        
        try {
          console.log(`[garmin-activities-webhook] Processing activity for Garmin user: ${garminUserId}, activity: ${summaryId}`);

          // Find user tokens using the official Garmin User API ID
          const { data: tokens, error: tokenError } = await supabaseClient
            .from('garmin_tokens')
            .select('user_id, access_token, is_active')
            .eq('garmin_user_id', garminUserId)
            .eq('is_active', true);

          if (tokenError) {
            console.error('[garmin-activities-webhook] Error finding tokens:', tokenError);
            continue;
          }

          if (tokens && tokens.length > 0) {
            // Log the webhook for each active user
            for (const token of tokens) {
              try {
                await supabaseClient
                  .from('garmin_webhook_logs')
                  .insert({
                    user_id: token.user_id,
                    webhook_type: 'activity_notification',
                    payload: activity,
                    status: 'received',
                    garmin_user_id: garminUserId
                  });

                // Trigger sync for this specific user's activities
                console.log(`[garmin-activities-webhook] Triggering activity sync for user: ${token.user_id}`);
                
                supabaseClient.functions.invoke('sync-garmin-activities', {
                  body: {
                    webhook_triggered: true,
                    callback_url: activity.callbackURL,
                    webhook_payload: activity,
                    timeRange: 'last_24_hours',
                    user_id: token.user_id,
                    garmin_access_token: token.access_token
                  }
                }).then(({ data: syncData, error: syncError }) => {
                  if (!syncError) {
                    console.log(`[garmin-activities-webhook] Successfully triggered sync for user: ${token.user_id}`);
                    
                    // Update webhook log status
                    supabaseClient
                      .from('garmin_webhook_logs')
                      .update({ status: 'sync_triggered' })
                      .eq('user_id', token.user_id)
                      .eq('webhook_type', 'activity_notification')
                      .eq('garmin_user_id', garminUserId)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .then(updateResult => {
                        if (updateResult.error) {
                          console.warn('[garmin-activities-webhook] Failed to update webhook log:', updateResult.error);
                        }
                      });

                  } else {
                    console.error(`[garmin-activities-webhook] Failed to trigger sync for user: ${token.user_id}`, syncError);
                  }
                }).catch(invokeError => {
                  console.error(`[garmin-activities-webhook] Failed to invoke sync function for user: ${token.user_id}`, invokeError);
                });

              } catch (userError) {
                console.error(`[garmin-activities-webhook] Error processing user ${token.user_id}:`, userError);
              }
            }

            console.log(`[garmin-activities-webhook] Successfully processed activity for user: ${garminUserId}`);
            results.push({ 
              userId: garminUserId, 
              summaryId,
              status: 'success',
              activityType,
              usersNotified: tokens.length
            });
          } else {
            console.log(`[garmin-activities-webhook] No active tokens found for Garmin user: ${garminUserId}`);
            
            // Still log the webhook attempt
            try {
              await supabaseClient
                .from('garmin_webhook_logs')
                .insert({
                  user_id: null,
                  webhook_type: 'activity_notification',
                  payload: activity,
                  status: 'no_active_user',
                  garmin_user_id: garminUserId
                });
            } catch (logError) {
              console.warn('[garmin-activities-webhook] Failed to log webhook attempt:', logError);
            }

            results.push({ userId: garminUserId, summaryId, status: 'no_active_user' });
          }
        } catch (error) {
          console.error(`[garmin-activities-webhook] Error processing activity for ${garminUserId}:`, error);
          
          // Log the error
          try {
            await supabaseClient
              .from('garmin_webhook_logs')
              .insert({
                user_id: null,
                webhook_type: 'activity_notification',
                payload: activity,
                status: 'error',
                error_message: error.message,
                garmin_user_id: garminUserId
              });
          } catch (logError) {
            console.warn('[garmin-activities-webhook] Failed to log error:', logError);
          }

          results.push({ 
            userId: garminUserId, 
            summaryId: activity.summaryId, 
            status: 'error', 
            error: error.message 
          });
        }
      }
      
      console.log('[garmin-activities-webhook] Background processing complete:', JSON.stringify(results, null, 2));
    };

    // Start background processing without waiting
    EdgeRuntime.waitUntil(processActivities());

    // Return immediate success response
    return successResponse([{ status: 'accepted', activitiesCount: activities.length }]);

  } catch (error) {
    console.error('[garmin-activities-webhook] Fatal error:', error);
    
    // CRITICAL: Still return success to Garmin to maintain webhook health
    return successResponse([{ error: error.message, status: 'fatal_error' }]);
  }
});
