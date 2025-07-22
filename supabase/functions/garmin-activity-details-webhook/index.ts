
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse webhook payload
    const payload: ActivityDetailsWebhookPayload = await req.json();
    console.log('Received activity details webhook payload:', JSON.stringify(payload, null, 2));

    if (!payload.activityDetails || !Array.isArray(payload.activityDetails)) {
      console.error('Invalid payload structure - missing activityDetails array');
      return new Response(JSON.stringify({ 
        error: 'Invalid payload structure',
        details: 'Expected activityDetails array' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    // Process each activity details notification
    for (const notification of payload.activityDetails) {
      const { userId: garminUserId, summaryId, activityId, callbackURL } = notification;
      
      console.log(`Processing activity details notification for Garmin user: ${garminUserId}, activity: ${activityId}`);

      try {
        // Find the user by garmin_user_id
        const { data: userTokens, error: tokenError } = await supabaseClient
          .from('garmin_tokens')
          .select('user_id, access_token, is_active')
          .eq('garmin_user_id', garminUserId)
          .eq('is_active', true)
          .maybeSingle();

        if (tokenError) {
          console.error(`Error finding user tokens for ${garminUserId}:`, tokenError);
          results.push({
            userId: garminUserId,
            summaryId,
            activityId,
            status: 'error',
            error: 'Failed to find user tokens'
          });
          continue;
        }

        if (!userTokens) {
          console.warn(`No active tokens found for Garmin user: ${garminUserId}`);
          results.push({
            userId: garminUserId,
            summaryId,
            activityId,
            status: 'error',
            error: 'No active tokens found'
          });
          continue;
        }

        // Log the webhook notification
        const { error: logError } = await supabaseClient
          .from('garmin_webhook_logs')
          .insert({
            user_id: userTokens.user_id,
            webhook_type: 'activity_details_notification',
            payload: notification,
            garmin_user_id: garminUserId,
            status: 'processing'
          });

        if (logError) {
          console.error('Error logging webhook notification:', logError);
        }

        // Trigger activity details sync using the user's access token
        console.log(`Triggering activity details sync for user: ${userTokens.user_id}`);
        
        const syncPayload = {
          webhook_triggered: true,
          garmin_user_id: garminUserId,
          ...(callbackURL && { callback_url: callbackURL }),
          ...(summaryId && { summary_id: summaryId }),
          ...(activityId && { activity_id: activityId }),
          webhook_payload: notification
        };

        const { data: syncData, error: syncError } = await supabaseClient.functions.invoke('sync-garmin-activity-details', {
          headers: {
            'Authorization': `Bearer ${userTokens.access_token}`,
            'Content-Type': 'application/json'
          },
          body: syncPayload
        });

        if (syncError) {
          console.error(`Error triggering sync for user: ${userTokens.user_id}`, syncError);
          results.push({
            userId: garminUserId,
            summaryId,
            activityId,
            status: 'error',
            error: 'Failed to trigger sync'
          });
          continue;
        }

        console.log(`Successfully triggered sync for user: ${userTokens.user_id}`);
        results.push({
          userId: garminUserId,
          summaryId,
          activityId,
          status: 'success',
          syncResult: syncData
        });

        // Update webhook log status
        await supabaseClient
          .from('garmin_webhook_logs')
          .update({ status: 'success' })
          .eq('user_id', userTokens.user_id)
          .eq('webhook_type', 'activity_details_notification')
          .eq('garmin_user_id', garminUserId);

      } catch (error) {
        console.error(`Error processing notification for ${garminUserId}:`, error);
        results.push({
          userId: garminUserId,
          summaryId,
          activityId,
          status: 'error',
          error: error.message
        });
      }
    }

    // Count successful notifications
    const successCount = results.filter(r => r.status === 'success').length;
    
    console.log(`Activity details webhook processing complete: ${JSON.stringify(results, null, 2)}`);

    return new Response(JSON.stringify({
      message: `Processed ${payload.activityDetails.length} activity details notifications`,
      successful: successCount,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in activity details webhook:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
