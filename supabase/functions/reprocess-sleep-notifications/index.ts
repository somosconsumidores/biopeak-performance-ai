import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReprocessRequest {
  webhook_id?: string;
  user_id?: string;
  hours_back?: number;
  dry_run?: boolean;
  limit?: number;
}

interface ReprocessResult {
  webhook_id: string;
  user_id: string;
  garmin_user_id: string;
  summary_id: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
}

serve(async (req) => {
  console.log(`[reprocess-sleep-notifications] ${req.method} request received`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse request body
    const body: ReprocessRequest = req.method === 'POST' ? await req.json() : {};
    const {
      webhook_id,
      user_id,
      hours_back = 24,
      dry_run = false,
      limit = 50
    } = body;

    console.log(`[reprocess-sleep-notifications] Processing with filters:`, {
      webhook_id,
      user_id,
      hours_back,
      dry_run,
      limit
    });

    // Build query for failed sleep notifications
    let query = supabase
      .from('garmin_webhook_logs')
      .select('*')
      .eq('webhook_type', 'sleep_notification')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (webhook_id) {
      query = query.eq('id', webhook_id);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (hours_back && !webhook_id) {
      const cutoffTime = new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', cutoffTime);
    }

    const { data: failedWebhooks, error: queryError } = await query;

    if (queryError) {
      console.error('[reprocess-sleep-notifications] Failed to query webhooks:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query failed webhooks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!failedWebhooks || failedWebhooks.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No failed sleep notifications found with the given criteria',
          total_found: 0,
          results: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reprocess-sleep-notifications] Found ${failedWebhooks.length} failed sleep notifications`);

    if (dry_run) {
      return new Response(
        JSON.stringify({
          message: 'Dry run completed - no webhooks were reprocessed',
          total_found: failedWebhooks.length,
          webhooks: failedWebhooks.map(w => ({
            id: w.id,
            user_id: w.user_id,
            garmin_user_id: w.garmin_user_id,
            created_at: w.created_at,
            error_message: w.error_message
          }))
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: ReprocessResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each failed webhook
    for (const webhook of failedWebhooks) {
      const { id: webhookId, user_id: webhookUserId, garmin_user_id: garminUserId, payload } = webhook;
      
      console.log(`[reprocess-sleep-notifications] Processing webhook ${webhookId} for user ${webhookUserId}`);

      // Extract sleep summaries from payload
      const sleepSummaries = payload?.sleeps || [];
      if (sleepSummaries.length === 0) {
        results.push({
          webhook_id: webhookId,
          user_id: webhookUserId || 'unknown',
          garmin_user_id: garminUserId || 'unknown',
          summary_id: 'none',
          status: 'skipped',
          message: 'No sleep summaries in payload'
        });
        skippedCount++;
        continue;
      }

      // Check if user has active Garmin token
      const { data: activeToken, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('access_token, user_id')
        .eq('user_id', webhookUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (tokenError || !activeToken) {
        console.log(`[reprocess-sleep-notifications] No active token for user ${webhookUserId}, moving to orphaned`);
        
        // Move to orphaned webhooks table
        await supabase
          .from('garmin_orphaned_webhooks')
          .insert({
            garmin_user_id: garminUserId,
            webhook_type: 'sleep_notification',
            webhook_payload: payload,
            user_id: webhookUserId,
            status: 'pending'
          });

        results.push({
          webhook_id: webhookId,
          user_id: webhookUserId || 'unknown',
          garmin_user_id: garminUserId || 'unknown',
          summary_id: 'multiple',
          status: 'skipped',
          message: 'No active token - moved to orphaned webhooks'
        });
        skippedCount++;
        continue;
      }

      // Generate user access token
      const { data: tokenResponse, error: authError } = await supabase.auth.admin.generateAccessToken(webhookUserId);
      
      if (authError || !tokenResponse.access_token) {
        console.error(`[reprocess-sleep-notifications] Failed to generate user token for ${webhookUserId}:`, authError);
        
        results.push({
          webhook_id: webhookId,
          user_id: webhookUserId,
          garmin_user_id: garminUserId || 'unknown',
          summary_id: 'multiple',
          status: 'error',
          message: 'Failed to generate user access token'
        });
        errorCount++;
        continue;
      }

      try {
        // Call sync-garmin-sleep function
        const syncResponse = await supabase.functions.invoke('sync-garmin-sleep', {
          body: {
            triggered_by_webhook: true,
            webhook_payload: payload,
            admin_override: true,
            user_id: webhookUserId,
            access_token: activeToken.access_token
          },
          headers: {
            'Authorization': `Bearer ${tokenResponse.access_token}`,
            'x-webhook-source': 'reprocess'
          }
        });

        if (syncResponse.error) {
          console.error(`[reprocess-sleep-notifications] Sync failed for webhook ${webhookId}:`, syncResponse.error);
          
          results.push({
            webhook_id: webhookId,
            user_id: webhookUserId,
            garmin_user_id: garminUserId || 'unknown',
            summary_id: sleepSummaries[0]?.summaryId || 'unknown',
            status: 'error',
            message: `Sync failed: ${syncResponse.error.message}`
          });
          errorCount++;
        } else {
          console.log(`[reprocess-sleep-notifications] Successfully reprocessed webhook ${webhookId}`);
          
          // Update webhook log status
          await supabase
            .from('garmin_webhook_logs')
            .update({
              status: 'success',
              error_message: null,
              processed_at: new Date().toISOString()
            })
            .eq('id', webhookId);

          results.push({
            webhook_id: webhookId,
            user_id: webhookUserId,
            garmin_user_id: garminUserId || 'unknown',
            summary_id: sleepSummaries[0]?.summaryId || 'unknown',
            status: 'success',
            message: 'Successfully reprocessed'
          });
          successCount++;
        }

      } catch (syncError) {
        console.error(`[reprocess-sleep-notifications] Exception during sync for webhook ${webhookId}:`, syncError);
        
        results.push({
          webhook_id: webhookId,
          user_id: webhookUserId,
          garmin_user_id: garminUserId || 'unknown',
          summary_id: sleepSummaries[0]?.summaryId || 'unknown',
          status: 'error',
          message: `Exception: ${syncError.message}`
        });
        errorCount++;
      }

      // Rate limiting between calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const response = {
      message: 'Reprocessing completed',
      total_processed: failedWebhooks.length,
      success_count: successCount,
      error_count: errorCount,
      skipped_count: skippedCount,
      results
    };

    console.log(`[reprocess-sleep-notifications] Completed: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[reprocess-sleep-notifications] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});