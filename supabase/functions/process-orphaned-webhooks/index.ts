import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    console.log('[process-orphaned-webhooks] Starting orphaned webhook processing...');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const results = {
      processed: 0,
      reprocessed: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Find pending orphaned webhooks
    const { data: orphanedWebhooks, error: orphanError } = await supabase
      .from('garmin_orphaned_webhooks')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3) // Max 3 retries
      .order('created_at', { ascending: true })
      .limit(50); // Process in batches

    if (orphanError) {
      console.error('[process-orphaned-webhooks] Error fetching orphaned webhooks:', orphanError);
      throw orphanError;
    }

    if (!orphanedWebhooks || orphanedWebhooks.length === 0) {
      console.log('[process-orphaned-webhooks] No orphaned webhooks to process');
      return new Response(JSON.stringify({
        success: true,
        message: 'No orphaned webhooks found',
        ...results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[process-orphaned-webhooks] Found ${orphanedWebhooks.length} orphaned webhooks to process`);

    for (const webhook of orphanedWebhooks) {
      try {
        results.processed++;
        
        // Check if user now has active tokens
        const { data: activeTokens, error: tokenError } = await supabase
          .from('garmin_tokens')
          .select('user_id, access_token, is_active')
          .eq('user_id', webhook.user_id)
          .eq('is_active', true)
          .limit(1);

        if (tokenError) {
          console.error(`[process-orphaned-webhooks] Token lookup error for webhook ${webhook.id}:`, tokenError);
          results.errors.push(`Token lookup failed for webhook ${webhook.id}: ${tokenError.message}`);
          continue;
        }

        if (activeTokens && activeTokens.length > 0) {
          // User has reconnected! Process the webhook
          console.log(`[process-orphaned-webhooks] User ${webhook.user_id} has reconnected, processing webhook ${webhook.id}`);
          
          const token = activeTokens[0];
          
          // Trigger sync for this specific activity
          const { error: syncError } = await supabase.functions.invoke('sync-garmin-activities', {
            body: {
              webhook_triggered: true,
              webhook_payload: webhook.webhook_payload,
              timeRange: 'specific_activity',
              user_id: webhook.user_id,
              garmin_access_token: token.access_token
            }
          });

          if (syncError) {
            console.error(`[process-orphaned-webhooks] Sync failed for webhook ${webhook.id}:`, syncError);
            
            // Update retry count and error
            await supabase
              .from('garmin_orphaned_webhooks')
              .update({
                retry_count: webhook.retry_count + 1,
                last_retry_at: new Date().toISOString(),
                error_message: syncError.message,
                status: webhook.retry_count >= 2 ? 'failed' : 'pending'
              })
              .eq('id', webhook.id);
              
            results.failed++;
            results.errors.push(`Sync failed for webhook ${webhook.id}: ${syncError.message}`);
          } else {
            // Mark as processed
            await supabase
              .from('garmin_orphaned_webhooks')
              .update({
                status: 'processed',
                processed_at: new Date().toISOString()
              })
              .eq('id', webhook.id);
              
            results.reprocessed++;
            console.log(`[process-orphaned-webhooks] Successfully reprocessed webhook ${webhook.id}`);
          }
        } else {
          // User still hasn't reconnected, increment retry count if it's been a while
          const webhookAge = Date.now() - new Date(webhook.created_at).getTime();
          const oneHour = 60 * 60 * 1000;
          
          if (webhookAge > oneHour) {
            await supabase
              .from('garmin_orphaned_webhooks')
              .update({
                retry_count: webhook.retry_count + 1,
                last_retry_at: new Date().toISOString(),
                status: webhook.retry_count >= 2 ? 'expired' : 'pending'
              })
              .eq('id', webhook.id);
              
            if (webhook.retry_count >= 2) {
              console.log(`[process-orphaned-webhooks] Webhook ${webhook.id} expired after max retries`);
            }
          }
        }
      } catch (webhookError) {
        console.error(`[process-orphaned-webhooks] Error processing webhook ${webhook.id}:`, webhookError);
        results.failed++;
        results.errors.push(`Processing failed for webhook ${webhook.id}: ${webhookError.message}`);
      }
    }

    console.log(`[process-orphaned-webhooks] Processing completed. Processed: ${results.processed}, Reprocessed: ${results.reprocessed}, Failed: ${results.failed}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Orphaned webhook processing completed',
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[process-orphaned-webhooks] Fatal error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});