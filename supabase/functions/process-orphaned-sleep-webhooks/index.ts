import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[process-orphaned-sleep-webhooks] Starting orphaned sleep webhook processing');

    // Fetch pending orphaned sleep webhooks with retry_count < 3
    const { data: orphanedWebhooks, error: fetchError } = await supabase
      .from('garmin_orphaned_webhooks')
      .select('*')
      .eq('status', 'pending')
      .eq('webhook_type', 'sleep_notification')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[process-orphaned-sleep-webhooks] Error fetching orphaned webhooks:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch orphaned webhooks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-orphaned-sleep-webhooks] Found ${orphanedWebhooks?.length || 0} orphaned sleep webhooks to process`);

    let processedCount = 0;
    let expiredCount = 0;

    for (const webhook of orphanedWebhooks || []) {
      try {
        console.log(`[process-orphaned-sleep-webhooks] Processing webhook ${webhook.id} for Garmin user ${webhook.garmin_user_id}`);

        // Check if the user has an active token now
        const { data: activeToken, error: tokenError } = await supabase
          .from('garmin_tokens')
          .select('user_id, access_token')
          .eq('garmin_user_id', webhook.garmin_user_id)
          .eq('is_active', true)
          .maybeSingle();

        if (tokenError) {
          console.error(`[process-orphaned-sleep-webhooks] Error checking token for webhook ${webhook.id}:`, tokenError);
          continue;
        }

        if (activeToken && activeToken.user_id) {
          console.log(`[process-orphaned-sleep-webhooks] Found active token for user ${activeToken.user_id}, processing sleep webhook`);

          // Invoke sync-garmin-sleep function
          const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-garmin-sleep', {
            body: {
              user_id: activeToken.user_id,
              webhook_payload: webhook.webhook_payload,
              is_webhook: true
            }
          });

          if (syncError) {
            console.error(`[process-orphaned-sleep-webhooks] Error invoking sync-garmin-sleep for webhook ${webhook.id}:`, syncError);
            
            // Update webhook with error
            await supabase
              .from('garmin_orphaned_webhooks')
              .update({
                retry_count: webhook.retry_count + 1,
                last_retry_at: new Date().toISOString(),
                error_message: `Sync error: ${syncError.message}`,
                status: webhook.retry_count + 1 >= 3 ? 'expired' : 'pending'
              })
              .eq('id', webhook.id);
              
            continue;
          }

          // Mark webhook as processed
          const { error: updateError } = await supabase
            .from('garmin_orphaned_webhooks')
            .update({
              status: 'processed',
              processed_at: new Date().toISOString(),
              user_id: activeToken.user_id
            })
            .eq('id', webhook.id);

          if (updateError) {
            console.error(`[process-orphaned-sleep-webhooks] Error updating webhook ${webhook.id}:`, updateError);
          } else {
            console.log(`[process-orphaned-sleep-webhooks] Successfully processed webhook ${webhook.id}`);
            processedCount++;
          }

        } else {
          // No active token found, increment retry count if webhook is old enough (1 hour)
          const webhookAge = new Date().getTime() - new Date(webhook.created_at).getTime();
          const oneHourInMs = 60 * 60 * 1000;

          if (webhookAge > oneHourInMs) {
            const newRetryCount = webhook.retry_count + 1;
            const newStatus = newRetryCount >= 3 ? 'expired' : 'pending';

            const { error: updateError } = await supabase
              .from('garmin_orphaned_webhooks')
              .update({
                retry_count: newRetryCount,
                last_retry_at: new Date().toISOString(),
                status: newStatus,
                error_message: newStatus === 'expired' ? 'No active token found after 3 retries' : 'No active token found'
              })
              .eq('id', webhook.id);

            if (updateError) {
              console.error(`[process-orphaned-sleep-webhooks] Error updating retry count for webhook ${webhook.id}:`, updateError);
            } else {
              console.log(`[process-orphaned-sleep-webhooks] Updated retry count for webhook ${webhook.id}, status: ${newStatus}`);
              if (newStatus === 'expired') {
                expiredCount++;
              }
            }
          } else {
            console.log(`[process-orphaned-sleep-webhooks] Webhook ${webhook.id} is too recent (${Math.round(webhookAge / 1000 / 60)} minutes), skipping`);
          }
        }

      } catch (error) {
        console.error(`[process-orphaned-sleep-webhooks] Error processing webhook ${webhook.id}:`, error);
        
        // Update webhook with error
        await supabase
          .from('garmin_orphaned_webhooks')
          .update({
            retry_count: webhook.retry_count + 1,
            last_retry_at: new Date().toISOString(),
            error_message: `Processing error: ${error.message}`,
            status: webhook.retry_count + 1 >= 3 ? 'expired' : 'pending'
          })
          .eq('id', webhook.id);
      }
    }

    console.log(`[process-orphaned-sleep-webhooks] Processing completed. Processed: ${processedCount}, Expired: ${expiredCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processing completed`,
        processedCount,
        expiredCount,
        totalChecked: orphanedWebhooks?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-orphaned-sleep-webhooks] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});