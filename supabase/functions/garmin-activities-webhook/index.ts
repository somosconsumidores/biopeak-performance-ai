
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
  
  // CRITICAL: Always return 200 OK with JSON for Garmin webhook health
  const createSuccessResponse = (data: any = {}) => {
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      ...data
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  };

  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return createSuccessResponse({ message: 'CORS preflight handled' });
    }

    console.log(`[garmin-activities-webhook] ${req.method} ${req.url} - User-Agent: ${req.headers.get('user-agent')}`);

    // Initialize Supabase client with error handling
    let supabaseClient;
    try {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
    } catch (clientError) {
      console.error('[garmin-activities-webhook] Supabase client init failed:', clientError);
      return createSuccessResponse({ 
        message: 'Service temporarily unavailable', 
        error: 'client_init_failed' 
      });
    }

    // Parse request body with maximum safety
    let payload: ActivitiesPayload = { activities: [] };
    let requestBody = '';
    
    try {
      requestBody = await req.text();
      console.log(`[garmin-activities-webhook] Raw request body: ${requestBody}`);
    } catch (readError) {
      console.error('[garmin-activities-webhook] Failed to read request body:', readError);
      return createSuccessResponse({ 
        message: 'Request body read error handled', 
        type: 'ping_response' 
      });
    }

    // Handle empty body (PING requests)
    if (!requestBody || requestBody.trim() === '' || requestBody === '{}') {
      console.log('[garmin-activities-webhook] Empty body detected - treating as PING');
      return createSuccessResponse({ 
        message: 'PING received and acknowledged',
        type: 'ping_response'
      });
    }

    // Parse JSON with fallback for malformed data
    try {
      payload = JSON.parse(requestBody);
      console.log('[garmin-activities-webhook] Parsed payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('[garmin-activities-webhook] JSON parse failed:', parseError);
      // Still return success for malformed JSON to satisfy Garmin
      return createSuccessResponse({ 
        message: 'Malformed JSON handled gracefully',
        type: 'malformed_json_response',
        originalBody: requestBody.substring(0, 100) // Log first 100 chars for debugging
      });
    }

    // Extract activities array safely
    const activities = Array.isArray(payload.activities) ? payload.activities : [];
    
    // Handle empty activities (another form of PING)
    if (activities.length === 0) {
      console.log('[garmin-activities-webhook] Empty activities array - treating as PING');
      return createSuccessResponse({ 
        message: 'Empty activities array handled',
        type: 'empty_activities_response'
      });
    }

    console.log(`[garmin-activities-webhook] Processing ${activities.length} activities`);

    // Process activities in background without blocking response
    const processActivitiesInBackground = async () => {
      const processingResults = [];
      
      for (const activity of activities) {
        if (!activity || typeof activity !== 'object') {
          console.warn('[garmin-activities-webhook] Invalid activity object, skipping');
          continue;
        }

        const { userId: garminUserId, summaryId, activityType } = activity;
        
        if (!garminUserId) {
          console.warn('[garmin-activities-webhook] Missing garminUserId, skipping activity');
          continue;
        }

        try {
          console.log(`[garmin-activities-webhook] Processing activity for Garmin user: ${garminUserId}, activity: ${summaryId}`);

          // Find user tokens
          const { data: tokens, error: tokenError } = await supabaseClient
            .from('garmin_tokens')
            .select('user_id, access_token, is_active')
            .eq('garmin_user_id', garminUserId)
            .eq('is_active', true);

          if (tokenError) {
            console.error('[garmin-activities-webhook] Token lookup error:', tokenError);
            continue;
          }

          if (tokens && tokens.length > 0) {
            // Process each active user
            for (const token of tokens) {
              try {
                // Log webhook receipt and immediately mark as processing
                const { data: webhookLog, error: logError } = await supabaseClient
                  .from('garmin_webhook_logs')
                  .insert({
                    user_id: token.user_id,
                    webhook_type: 'activity_notification',
                    payload: activity,
                    status: 'processing',
                    garmin_user_id: garminUserId
                  })
                  .select('id')
                  .single();

                if (logError) {
                  console.error('[garmin-activities-webhook] Failed to log webhook:', logError);
                  return;
                }

                // Trigger background sync (fire and forget)
                supabaseClient.functions.invoke('sync-garmin-activities', {
                  body: {
                    webhook_triggered: true,
                    callback_url: activity.callbackURL,
                    webhook_payload: activity,
                    timeRange: 'last_24_hours',
                    user_id: token.user_id,
                    garmin_access_token: token.access_token
                  }
                }).then(({ error: syncError }) => {
                  const status = syncError ? 'sync_failed' : 'sync_triggered';
                  
                  // Update webhook log using the specific ID
                  supabaseClient
                    .from('garmin_webhook_logs')
                    .update({ 
                      status,
                      processed_at: new Date().toISOString(),
                      error_message: syncError?.message || null
                    })
                    .eq('id', webhookLog.id)
                    .then(() => {
                      console.log(`[garmin-activities-webhook] Updated webhook log status to: ${status} for user: ${token.user_id}`);
                    })
                    .catch(updateError => {
                      console.warn('[garmin-activities-webhook] Failed to update webhook log:', updateError);
                    });

                  if (syncError) {
                    console.error(`[garmin-activities-webhook] Sync failed for user: ${token.user_id}`, syncError);
                  } else {
                    console.log(`[garmin-activities-webhook] Sync triggered for user: ${token.user_id}`);
                  }
                }).catch(invokeError => {
                  console.error(`[garmin-activities-webhook] Sync invoke error for user: ${token.user_id}`, invokeError);
                });

              } catch (userProcessingError) {
                console.error(`[garmin-activities-webhook] User processing error for ${token.user_id}:`, userProcessingError);
              }
            }

            processingResults.push({
              userId: garminUserId,
              summaryId,
              status: 'success',
              activityType,
              usersNotified: tokens.length
            });

          } else {
            console.log(`[garmin-activities-webhook] No active tokens found for Garmin user: ${garminUserId}`);
            
            // Log orphaned webhook
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
              console.warn('[garmin-activities-webhook] Failed to log orphaned webhook:', logError);
            }

            processingResults.push({
              userId: garminUserId,
              summaryId,
              status: 'no_active_user'
            });
          }

        } catch (activityError) {
          console.error(`[garmin-activities-webhook] Activity processing error for ${garminUserId}:`, activityError);
          
          // Log error
          try {
            await supabaseClient
              .from('garmin_webhook_logs')
              .insert({
                user_id: null,
                webhook_type: 'activity_notification',
                payload: activity,
                status: 'error',
                error_message: activityError.message,
                garmin_user_id: garminUserId
              });
          } catch (logError) {
            console.warn('[garmin-activities-webhook] Failed to log activity error:', logError);
          }

          processingResults.push({
            userId: garminUserId,
            summaryId: activity.summaryId,
            status: 'error',
            error: activityError.message
          });
        }
      }
      
      console.log('[garmin-activities-webhook] Background processing completed:', processingResults.length, 'activities processed');
    };

    // Start background processing without awaiting
    EdgeRuntime.waitUntil(processActivitiesInBackground());

    // Return immediate success response to Garmin
    return createSuccessResponse({
      message: 'Activities received and processing started',
      activitiesCount: activities.length,
      type: 'activities_response'
    });

  } catch (fatalError) {
    console.error('[garmin-activities-webhook] Fatal error:', fatalError);
    
    // CRITICAL: Always return 200 OK even for fatal errors
    return createSuccessResponse({
      message: 'Fatal error handled gracefully',
      error: fatalError.message,
      type: 'error_response'
    });
  }
});
