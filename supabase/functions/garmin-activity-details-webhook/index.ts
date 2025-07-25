
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityDetailsNotification {
  userId: string
  summaryId?: string
  activityId?: string
  uploadStartTimeInSeconds?: number
  uploadEndTimeInSeconds?: number
  callbackURL?: string
}

interface ActivityDetailsWebhookPayload {
  activityDetails: ActivityDetailsNotification[]
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // CRITICAL: Always return success to Garmin within 3 seconds
  const createSuccessResponse = (message: string, data: any = {}) => {
    return new Response(JSON.stringify({
      success: true,
      message: message,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      ...data
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  };

  // Set timeout to ensure response within 3 seconds
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(createSuccessResponse('Request processed with timeout protection', { 
        timeout: true,
        processingTime: 3000 
      }));
    }, 2800); // 2.8 seconds to allow for response time
  });

  const processingPromise = (async () => {
    try {
      console.log(`[garmin-activity-details-webhook] ${req.method} ${req.url}`);

      // Initialize Supabase client
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Parse webhook payload with error handling
      let payload: ActivityDetailsWebhookPayload;
      try {
        const text = await req.text();
        console.log('[garmin-activity-details-webhook] Raw payload:', text);
        
        if (!text || text.trim() === '') {
          console.log('[garmin-activity-details-webhook] Empty payload received');
          return createSuccessResponse('Empty payload processed successfully');
        }
        
        payload = JSON.parse(text);
        console.log('[garmin-activity-details-webhook] Parsed payload:', JSON.stringify(payload, null, 2));
      } catch (parseError) {
        console.error('[garmin-activity-details-webhook] Failed to parse JSON payload:', parseError);
        return createSuccessResponse('Invalid JSON payload processed successfully', { 
          parseError: parseError.message 
        });
      }

      // Handle missing or invalid activityDetails array
      if (!payload || !payload.activityDetails || !Array.isArray(payload.activityDetails)) {
        console.warn('[garmin-activity-details-webhook] Invalid payload structure - missing activityDetails array');
        return createSuccessResponse('Invalid payload structure processed successfully', { 
          receivedPayload: payload 
        });
      }

      const results = [];

      // Process each activity details notification
      for (const notification of payload.activityDetails) {
        const { userId: garminUserId, summaryId, activityId, callbackURL, uploadStartTimeInSeconds, uploadEndTimeInSeconds } = notification;
        
        console.log(`[garmin-activity-details-webhook] Processing activity details for Garmin user: ${garminUserId}, activity: ${activityId}`);

        try {
          // Validate required fields
          if (!garminUserId) {
            console.warn('[garmin-activity-details-webhook] Missing garminUserId in notification');
            results.push({
              status: 'success',
              message: 'Missing garminUserId processed successfully'
            });
            continue;
          }

          // Find the user by garmin_user_id
          const { data: userTokensList, error: tokenError } = await supabaseClient
            .from('garmin_tokens')
            .select('user_id, access_token, is_active, updated_at')
            .eq('garmin_user_id', garminUserId)
            .eq('is_active', true)
            .order('updated_at', { ascending: false });

          if (tokenError) {
            console.error(`[garmin-activity-details-webhook] Error finding user tokens for ${garminUserId}:`, tokenError);
            results.push({
              userId: garminUserId,
              summaryId,
              activityId,
              status: 'success',
              message: 'Token lookup error processed successfully'
            });
            continue;
          }

          if (!userTokensList || userTokensList.length === 0) {
            console.warn(`[garmin-activity-details-webhook] No active tokens found for Garmin user: ${garminUserId}`);
            results.push({
              userId: garminUserId,
              summaryId,
              activityId,
              status: 'success',
              message: 'No active user found - processed successfully'
            });
            continue;
          }

          const userTokens = userTokensList[0];
          if (userTokensList.length > 1) {
            console.warn(`[garmin-activity-details-webhook] Multiple active tokens found for Garmin user ${garminUserId}, using most recent from user ${userTokens.user_id}`);
          }

          // Update backfill request status if this is from a backfill
          if (uploadStartTimeInSeconds && uploadEndTimeInSeconds) {
            try {
              await updateBackfillRequestStatus(supabaseClient, userTokens.user_id, uploadStartTimeInSeconds, uploadEndTimeInSeconds, notification);
            } catch (backfillError) {
              console.warn('[garmin-activity-details-webhook] Backfill update error (non-critical):', backfillError);
            }
          }

          // Log the webhook notification and get the ID for tracking
          let webhookLogId: string | null = null;
          try {
            const { data: logData, error: logError } = await supabaseClient
              .from('garmin_webhook_logs')
              .insert({
                user_id: userTokens.user_id,
                webhook_type: 'activity_details_notification',
                payload: notification,
                garmin_user_id: garminUserId,
                status: 'processing'
              })
              .select('id')
              .single();

            if (logError) {
              console.warn('[garmin-activity-details-webhook] Failed to log webhook notification:', logError);
            } else {
              webhookLogId = logData.id;
            }
          } catch (logError) {
            console.warn('[garmin-activity-details-webhook] Failed to log webhook notification (non-critical):', logError);
          }

          // Trigger activity details sync in background
          console.log(`[garmin-activity-details-webhook] Triggering activity details sync for user: ${userTokens.user_id}`);
          
          const syncPayload = {
            webhook_triggered: true,
            user_id: userTokens.user_id,
            garmin_access_token: userTokens.access_token,
            garmin_user_id: garminUserId,
            ...(callbackURL && { callback_url: callbackURL }),
            ...(summaryId && { summary_id: summaryId }),
            ...(activityId && { activity_id: activityId }),
            ...(uploadStartTimeInSeconds && { uploadStartTimeInSeconds }),
            ...(uploadEndTimeInSeconds && { uploadEndTimeInSeconds }),
            webhook_payload: notification
          };

          // Fire and forget - don't wait for sync completion
          supabaseClient.functions.invoke('sync-garmin-activity-details', {
            body: syncPayload
          }).then(({ error: syncError }) => {
            const status = syncError ? 'sync_failed' : 'success';
            
            console.log(`[garmin-activity-details-webhook] Sync result for user ${userTokens.user_id}: ${status}`);
            
            // Update webhook log status using specific ID if available
            if (webhookLogId) {
              supabaseClient
                .from('garmin_webhook_logs')
                .update({ 
                  status,
                  processed_at: new Date().toISOString(),
                  error_message: syncError?.message || null
                })
                .eq('id', webhookLogId)
                .then(() => {
                  console.log(`[garmin-activity-details-webhook] Webhook log updated for user: ${userTokens.user_id}`);
                })
                .catch((updateError) => {
                  console.warn('[garmin-activity-details-webhook] Failed to update webhook log status:', updateError);
                });
            }

            if (syncError) {
              console.error(`[garmin-activity-details-webhook] Sync error for user: ${userTokens.user_id}`, syncError);
            }
          }).catch((invokeError) => {
            console.error(`[garmin-activity-details-webhook] Error invoking sync for user: ${userTokens.user_id}`, invokeError);
            
            // Update webhook log to failed if we have the ID
            if (webhookLogId) {
              supabaseClient
                .from('garmin_webhook_logs')
                .update({ 
                  status: 'sync_failed',
                  processed_at: new Date().toISOString(),
                  error_message: `Sync invoke error: ${invokeError.message}`
                })
                .eq('id', webhookLogId)
                .catch((updateError) => {
                  console.warn('[garmin-activity-details-webhook] Failed to update webhook log status after invoke error:', updateError);
                });
            }
          });

          results.push({
            userId: garminUserId,
            summaryId,
            activityId,
            status: 'success',
            message: 'Activity details notification processed successfully'
          });

        } catch (error) {
          console.error(`[garmin-activity-details-webhook] Error processing notification for ${garminUserId}:`, error);
          results.push({
            userId: garminUserId,
            summaryId,
            activityId,
            status: 'success',
            message: 'Processing error handled successfully'
          });
        }
      }

      console.log(`[garmin-activity-details-webhook] Processing complete: ${JSON.stringify(results, null, 2)}`);
      return createSuccessResponse(`Processed ${results.length} activity details notifications`, {
        results: results,
        processed: results.length
      });

    } catch (error) {
      console.error('[garmin-activity-details-webhook] Fatal error:', error);
      
      // CRITICAL: Still return success to Garmin to maintain webhook health
      return createSuccessResponse('Fatal error handled successfully', { 
        error: error.message 
      });
    }
  })();

  // Race between processing and timeout
  return await Promise.race([processingPromise, timeoutPromise]);
});

async function updateBackfillRequestStatus(
  supabaseClient: any, 
  userId: string, 
  uploadStartTimeInSeconds: number, 
  uploadEndTimeInSeconds: number, 
  notification: any
) {
  try {
    console.log(`[garmin-activity-details-webhook] Updating backfill request status for user ${userId}, time range ${uploadStartTimeInSeconds}-${uploadEndTimeInSeconds}`);
    
    // Find matching backfill request
    const { data: backfillRequests, error: findError } = await supabaseClient
      .from('garmin_backfill_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('request_type', 'activity_details')
      .lte('time_range_start', uploadStartTimeInSeconds)
      .gte('time_range_end', uploadEndTimeInSeconds)
      .in('status', ['triggered', 'in_progress'])
      .order('triggered_at', { ascending: false });

    if (findError) {
      console.error('[garmin-activity-details-webhook] Error finding backfill requests:', findError);
      return;
    }

    if (!backfillRequests || backfillRequests.length === 0) {
      console.log('[garmin-activity-details-webhook] No matching backfill request found');
      return;
    }

    // Update the most recent matching request
    const backfillRequest = backfillRequests[0];
    const existingNotifications = backfillRequest.webhook_notifications || [];
    const updatedNotifications = [...existingNotifications, {
      timestamp: new Date().toISOString(),
      notification: notification
    }];

    const { error: updateError } = await supabaseClient
      .from('garmin_backfill_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        activity_details_received: (backfillRequest.activity_details_received || 0) + 1,
        webhook_notifications: updatedNotifications
      })
      .eq('id', backfillRequest.id);

    if (updateError) {
      console.error('[garmin-activity-details-webhook] Error updating backfill request:', updateError);
    } else {
      console.log(`[garmin-activity-details-webhook] Updated backfill request ${backfillRequest.id} status to completed`);
    }

  } catch (error) {
    console.error('[garmin-activity-details-webhook] Error in updateBackfillRequestStatus:', error);
  }
}
