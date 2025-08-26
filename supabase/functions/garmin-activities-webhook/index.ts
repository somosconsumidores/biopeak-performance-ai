
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

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
  
  // CRITICAL: Implement timeout safety to guarantee response within 5 seconds
  const RESPONSE_TIMEOUT = 5000; // 5 seconds maximum
  let timeoutId: number | null = null;
  let responseAlreadySent = false;
  
  // CRITICAL: Always return 200 OK with JSON for Garmin webhook health
  const createSuccessResponse = (data: any = {}) => {
    if (responseAlreadySent) return null;
    responseAlreadySent = true;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
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

  // Emergency timeout fallback
  const timeoutPromise = new Promise<Response>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn('[garmin-activities-webhook] EMERGENCY TIMEOUT - Sending immediate response');
      const response = createSuccessResponse({
        message: 'Emergency timeout response',
        type: 'timeout_response'
      });
      if (response) resolve(response);
    }, RESPONSE_TIMEOUT);
  });

  const mainProcessing = async (): Promise<Response> => {
    try {
      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        const response = createSuccessResponse({ message: 'CORS preflight handled' });
        return response || new Response('OK', { status: 200, headers: corsHeaders });
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
        const response = createSuccessResponse({ 
          message: 'Service temporarily unavailable', 
          error: 'client_init_failed' 
        });
        return response || new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Parse request body with maximum safety
      let payload: ActivitiesPayload = { activities: [] };
      let requestBody = '';
      
      try {
        requestBody = await req.text();
        console.log(`[garmin-activities-webhook] Raw request body: ${requestBody}`);
      } catch (readError) {
        console.error('[garmin-activities-webhook] Failed to read request body:', readError);
        const response = createSuccessResponse({ 
          message: 'Request body read error handled', 
          type: 'ping_response' 
        });
        return response || new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Handle empty body (PING requests)
      if (!requestBody || requestBody.trim() === '' || requestBody === '{}') {
        console.log('[garmin-activities-webhook] Empty body detected - treating as PING');
        const response = createSuccessResponse({ 
          message: 'PING received and acknowledged',
          type: 'ping_response'
        });
        return response || new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Parse JSON with fallback for malformed data
      try {
        payload = JSON.parse(requestBody);
        console.log('[garmin-activities-webhook] Parsed payload:', JSON.stringify(payload, null, 2));
      } catch (parseError) {
        console.error('[garmin-activities-webhook] JSON parse failed:', parseError);
        // Still return success for malformed JSON to satisfy Garmin
        const response = createSuccessResponse({ 
          message: 'Malformed JSON handled gracefully',
          type: 'malformed_json_response',
          originalBody: requestBody.substring(0, 100) // Log first 100 chars for debugging
        });
        return response || new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Extract activities array safely
      const activities = Array.isArray(payload.activities) ? payload.activities : [];
      
      // Handle empty activities (another form of PING)
      if (activities.length === 0) {
        console.log('[garmin-activities-webhook] Empty activities array - treating as PING');
        const response = createSuccessResponse({ 
          message: 'Empty activities array handled',
          type: 'empty_activities_response'
        });
        return response || new Response('OK', { status: 200, headers: corsHeaders });
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

            let finalUserId = null;
            let accessToken = null;

            if (tokens && tokens.length > 0) {
              // We have active tokens
              finalUserId = tokens[0].user_id;
              accessToken = tokens[0].access_token;
              
              // Process the active token
              try {
                // Log webhook receipt and immediately mark as processing
                const { data: webhookLog, error: logError } = await supabaseClient
                  .from('garmin_webhook_logs')
                  .insert({
                    user_id: finalUserId,
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
                    user_id: finalUserId,
                    garmin_access_token: accessToken
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
                      console.log(`[garmin-activities-webhook] Updated webhook log status to: ${status} for user: ${finalUserId}`);
                    })
                    .catch(updateError => {
                      console.warn('[garmin-activities-webhook] Failed to update webhook log:', updateError);
                    });

                  if (syncError) {
                    console.error(`[garmin-activities-webhook] Sync failed for user: ${finalUserId}`, syncError);
                  } else {
                    console.log(`[garmin-activities-webhook] Sync triggered for user: ${finalUserId}`);
                  }
                }).catch(invokeError => {
                  console.error(`[garmin-activities-webhook] Sync invoke error for user: ${finalUserId}`, invokeError);
                });

              } catch (userProcessingError) {
                console.error(`[garmin-activities-webhook] User processing error for ${finalUserId}:`, userProcessingError);
              }

              processingResults.push({
                userId: garminUserId,
                summaryId,
                status: 'success',
                activityType,
                usersNotified: 1
              });

            } else {
              console.log(`[garmin-activities-webhook] No active tokens found for Garmin user: ${garminUserId}, checking mapping table...`);
              
              // Try to find user in permanent mapping table
              const { data: mappedUserId, error: mappingError } = await supabaseClient
                .rpc('find_user_by_garmin_id', { garmin_user_id_param: garminUserId });
              
              if (mappedUserId && !mappingError) {
                console.log(`[garmin-activities-webhook] Found mapped user ${mappedUserId} for Garmin user ${garminUserId}`);
                
                // Store webhook as orphaned for later processing
                try {
                  await supabaseClient
                    .from('garmin_orphaned_webhooks')
                    .insert({
                      garmin_user_id: garminUserId,
                      webhook_payload: activity,
                      webhook_type: 'activities',
                      user_id: mappedUserId,
                      status: 'pending'
                    });
                } catch (orphanError) {
                  console.warn('[garmin-activities-webhook] Failed to store orphaned webhook:', orphanError);
                }
                
                // Log webhook with recovered user
                try {
                  await supabaseClient
                    .from('garmin_webhook_logs')
                    .insert({
                      user_id: mappedUserId,
                      webhook_type: 'activity_notification',
                      payload: activity,
                      status: 'user_recovered_needs_reauth',
                      garmin_user_id: garminUserId
                    });
                } catch (logError) {
                  console.warn('[garmin-activities-webhook] Failed to log recovered user webhook:', logError);
                }
                
                processingResults.push({
                  userId: garminUserId,
                  summaryId,
                  status: 'user_recovered_needs_reauth',
                  recoveredUserId: mappedUserId
                });
                
                console.log(`[garmin-activities-webhook] Webhook stored as orphaned for user ${mappedUserId}, needs reauth`);
              } else {
                // Truly no user found - this is a completely unknown Garmin user
                console.warn(`[garmin-activities-webhook] No user mapping found for Garmin user ${garminUserId}`);
                
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

      // Start background processing with fallback
      try {
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
          EdgeRuntime.waitUntil(processActivitiesInBackground());
        } else {
          // Fallback: start processing in background without blocking
          processActivitiesInBackground().catch(bgError => {
            console.error('[garmin-activities-webhook] Background processing failed:', bgError);
          });
        }
      } catch (waitUntilError) {
        console.warn('[garmin-activities-webhook] EdgeRuntime.waitUntil failed, using fallback:', waitUntilError);
        processActivitiesInBackground().catch(bgError => {
          console.error('[garmin-activities-webhook] Fallback background processing failed:', bgError);
        });
      }

      // Return immediate success response to Garmin
      const response = createSuccessResponse({
        message: 'Activities received and processing started',
        activitiesCount: activities.length,
        type: 'activities_response'
      });
      
      return response || new Response('OK', { status: 200, headers: corsHeaders });

    } catch (fatalError) {
      console.error('[garmin-activities-webhook] Fatal error:', fatalError);
      
      // CRITICAL: Always return 200 OK even for fatal errors
      const response = createSuccessResponse({
        message: 'Fatal error handled gracefully',
        error: fatalError.message,
        type: 'error_response'
      });
      
      return response || new Response('OK', { status: 200, headers: corsHeaders });
    }
  };

  // Race between main processing and timeout
  return Promise.race([mainProcessing(), timeoutPromise]);
});
