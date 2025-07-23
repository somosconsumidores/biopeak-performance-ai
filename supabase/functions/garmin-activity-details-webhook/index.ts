
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

  // Always return success to Garmin - this is critical for webhook health
  const successResponse = (results: any[] = []) => new Response(JSON.stringify({
    message: `Processed activity details notifications`,
    successful: results.filter(r => r.status === 'success').length,
    results: results,
    timestamp: new Date().toISOString(),
    processingTime: Date.now() - startTime
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    console.log(`[garmin-activity-details-webhook] ${req.method} ${req.url}`);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse webhook payload
    let payload: ActivityDetailsWebhookPayload;
    try {
      payload = await req.json();
      console.log('[garmin-activity-details-webhook] Received payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('[garmin-activity-details-webhook] Failed to parse JSON payload:', parseError);
      return successResponse([{ error: 'Invalid JSON payload', status: 'error' }]);
    }

    if (!payload.activityDetails || !Array.isArray(payload.activityDetails)) {
      console.error('[garmin-activity-details-webhook] Invalid payload structure - missing activityDetails array');
      return successResponse([{ error: 'Invalid payload structure', status: 'error' }]);
    }

    const results = [];

    // Process each activity details notification
    for (const notification of payload.activityDetails) {
      const { userId: garminUserId, summaryId, activityId, callbackURL, uploadStartTimeInSeconds, uploadEndTimeInSeconds } = notification;
      
      console.log(`[garmin-activity-details-webhook] Processing activity details for Garmin user: ${garminUserId}, activity: ${activityId}`);

      try {
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
            status: 'error',
            error: 'Failed to find user tokens'
          });
          continue;
        }

        if (!userTokensList || userTokensList.length === 0) {
          console.warn(`[garmin-activity-details-webhook] No active tokens found for Garmin user: ${garminUserId}`);
          results.push({
            userId: garminUserId,
            summaryId,
            activityId,
            status: 'no_active_user'
          });
          continue;
        }

        const userTokens = userTokensList[0];
        if (userTokensList.length > 1) {
          console.warn(`[garmin-activity-details-webhook] Multiple active tokens found for Garmin user ${garminUserId}, using most recent from user ${userTokens.user_id}`);
        }

        // Update backfill request status if this is from a backfill
        if (uploadStartTimeInSeconds && uploadEndTimeInSeconds) {
          await updateBackfillRequestStatus(supabaseClient, userTokens.user_id, uploadStartTimeInSeconds, uploadEndTimeInSeconds, notification);
        }

        // Log the webhook notification
        try {
          await supabaseClient
            .from('garmin_webhook_logs')
            .insert({
              user_id: userTokens.user_id,
              webhook_type: 'activity_details_notification',
              payload: notification,
              garmin_user_id: garminUserId,
              status: 'processing'
            });
        } catch (logError) {
          console.warn('[garmin-activity-details-webhook] Failed to log webhook notification:', logError);
        }

        // Trigger activity details sync
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

        const { data: syncData, error: syncError } = await supabaseClient.functions.invoke('sync-garmin-activity-details', {
          body: syncPayload
        });

        if (syncError) {
          console.error(`[garmin-activity-details-webhook] Error triggering sync for user: ${userTokens.user_id}`, syncError);
          results.push({
            userId: garminUserId,
            summaryId,
            activityId,
            status: 'error',
            error: 'Failed to trigger sync'
          });
          continue;
        }

        console.log(`[garmin-activity-details-webhook] Successfully triggered sync for user: ${userTokens.user_id}`);
        results.push({
          userId: garminUserId,
          summaryId,
          activityId,
          status: 'success',
          syncResult: syncData
        });

        // Update webhook log status
        try {
          await supabaseClient
            .from('garmin_webhook_logs')
            .update({ status: 'success' })
            .eq('user_id', userTokens.user_id)
            .eq('webhook_type', 'activity_details_notification')
            .eq('garmin_user_id', garminUserId)
            .order('created_at', { ascending: false })
            .limit(1);
        } catch (updateError) {
          console.warn('[garmin-activity-details-webhook] Failed to update webhook log status:', updateError);
        }

      } catch (error) {
        console.error(`[garmin-activity-details-webhook] Error processing notification for ${garminUserId}:`, error);
        results.push({
          userId: garminUserId,
          summaryId,
          activityId,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`[garmin-activity-details-webhook] Processing complete: ${JSON.stringify(results, null, 2)}`);
    return successResponse(results);

  } catch (error) {
    console.error('[garmin-activity-details-webhook] Fatal error:', error);
    
    // CRITICAL: Still return success to Garmin to maintain webhook health
    return successResponse([{ error: error.message, status: 'fatal_error' }]);
  }
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
