import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FailedWebhook {
  id: string
  user_id: string
  webhook_type: string
  payload: any
  created_at: string
  garmin_user_id?: string
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

    // Parse request body
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch (e) {
      console.log('[reprocess-failed-webhooks] No request body provided, processing all failed webhooks');
    }

    const {
      webhook_id,
      user_id,
      hours_back = 24,
      webhook_type = null,
      dry_run = false
    } = requestBody;

    console.log(`[reprocess-failed-webhooks] Starting reprocessing - webhook_id: ${webhook_id}, user_id: ${user_id}, hours_back: ${hours_back}, type: ${webhook_type}, dry_run: ${dry_run}`);

    // Build query to find failed webhooks
    let query = supabaseClient
      .from('garmin_webhook_logs')
      .select('*')
      .eq('status', 'success') // Paradoxally, we want 'success' status but missing data
      .gte('created_at', new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (webhook_id) {
      query = query.eq('id', webhook_id);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (webhook_type) {
      query = query.eq('webhook_type', webhook_type);
    }

    const { data: webhookLogs, error: webhookError } = await query.limit(100);

    if (webhookError) {
      console.error('[reprocess-failed-webhooks] Error fetching webhook logs:', webhookError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch webhook logs' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log(`[reprocess-failed-webhooks] Found ${webhookLogs?.length || 0} webhook logs to check`);

    const failedWebhooks: FailedWebhook[] = [];
    const reprocessResults: any[] = [];

    // Check each webhook log for missing corresponding data
    for (const webhook of webhookLogs || []) {
      try {
        let hasMissingData = false;
        let missingDataDetails = '';

        if (webhook.webhook_type === 'activity_details_notification') {
          // Check if corresponding garmin_activity_details exists
          const activityDetails = webhook.payload?.activityDetails || [];
          
          for (const detail of activityDetails) {
            if (detail.summaryId) {
              const { data: existingDetails } = await supabaseClient
                .from('garmin_activity_details')
                .select('id')
                .eq('user_id', webhook.user_id)
                .eq('summary_id', detail.summaryId)
                .limit(1);

              if (!existingDetails || existingDetails.length === 0) {
                hasMissingData = true;
                missingDataDetails = `Missing activity details for summary_id: ${detail.summaryId}`;
                console.log(`[reprocess-failed-webhooks] Found missing data for webhook ${webhook.id}: ${missingDataDetails}`);
                break;
              }
            }
          }
        } else if (webhook.webhook_type === 'activity_notification') {
          // Check if corresponding garmin_activities exists
          const activities = webhook.payload?.activities || [];
          
          for (const activity of activities) {
            if (activity.summaryId) {
              const { data: existingActivity } = await supabaseClient
                .from('garmin_activities')
                .select('id')
                .eq('user_id', webhook.user_id)
                .eq('summary_id', activity.summaryId)
                .limit(1);

              if (!existingActivity || existingActivity.length === 0) {
                hasMissingData = true;
                missingDataDetails = `Missing activity for summary_id: ${activity.summaryId}`;
                console.log(`[reprocess-failed-webhooks] Found missing data for webhook ${webhook.id}: ${missingDataDetails}`);
                break;
              }
            }
          }
        }

        if (hasMissingData) {
          failedWebhooks.push({
            id: webhook.id,
            user_id: webhook.user_id,
            webhook_type: webhook.webhook_type,
            payload: webhook.payload,
            created_at: webhook.created_at,
            garmin_user_id: webhook.garmin_user_id
          });

          // If not dry run, attempt to reprocess
          if (!dry_run) {
            console.log(`[reprocess-failed-webhooks] Reprocessing webhook ${webhook.id} (${webhook.webhook_type})`);
            
            let reprocessResult = { webhook_id: webhook.id, success: false, error: null };

            try {
              if (webhook.webhook_type === 'activity_details_notification') {
                // Reprocess activity details
                const { data: syncResult, error: syncError } = await supabaseClient.functions.invoke('sync-garmin-activity-details', {
                  body: {
                    webhook_triggered: true,
                    user_id: webhook.user_id,
                    webhook_payload: webhook.payload,
                    garmin_access_token: 'reprocess_webhook', // Special marker
                    admin_override: true // Override for reprocessing
                  }
                });

                if (syncError) {
                  console.error(`[reprocess-failed-webhooks] Error reprocessing activity details for webhook ${webhook.id}:`, syncError);
                  reprocessResult.error = syncError.message;
                } else {
                  console.log(`[reprocess-failed-webhooks] Successfully reprocessed activity details for webhook ${webhook.id}`);
                  reprocessResult.success = true;
                }
              } else if (webhook.webhook_type === 'activity_notification') {
                // Reprocess activities
                const { data: syncResult, error: syncError } = await supabaseClient.functions.invoke('sync-garmin-activities', {
                  body: {
                    webhook_triggered: true,
                    user_id: webhook.user_id,
                    webhook_payload: webhook.payload,
                    garmin_access_token: 'reprocess_webhook', // Special marker
                    manual_sync: true // Override for reprocessing
                  }
                });

                if (syncError) {
                  console.error(`[reprocess-failed-webhooks] Error reprocessing activities for webhook ${webhook.id}:`, syncError);
                  reprocessResult.error = syncError.message;
                } else {
                  console.log(`[reprocess-failed-webhooks] Successfully reprocessed activities for webhook ${webhook.id}`);
                  reprocessResult.success = true;
                }
              }
            } catch (error) {
              console.error(`[reprocess-failed-webhooks] Unexpected error reprocessing webhook ${webhook.id}:`, error);
              reprocessResult.error = error.message;
            }

            reprocessResults.push(reprocessResult);

            // Add small delay between reprocessing to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.error(`[reprocess-failed-webhooks] Error checking webhook ${webhook.id}:`, error);
      }
    }

    const result = {
      message: dry_run 
        ? `Found ${failedWebhooks.length} webhooks with missing data (dry run)` 
        : `Reprocessed ${reprocessResults.filter(r => r.success).length} of ${failedWebhooks.length} failed webhooks`,
      failed_webhooks_found: failedWebhooks.length,
      reprocessed_successfully: dry_run ? 0 : reprocessResults.filter(r => r.success).length,
      reprocessed_with_errors: dry_run ? 0 : reprocessResults.filter(r => !r.success).length,
      dry_run,
      failed_webhooks: dry_run ? failedWebhooks.map(w => ({
        id: w.id,
        user_id: w.user_id,
        webhook_type: w.webhook_type,
        created_at: w.created_at
      })) : undefined,
      reprocess_results: dry_run ? undefined : reprocessResults
    };

    console.log('[reprocess-failed-webhooks] Completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[reprocess-failed-webhooks] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});