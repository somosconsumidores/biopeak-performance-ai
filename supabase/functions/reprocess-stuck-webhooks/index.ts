import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  console.log(`[reprocess-stuck-webhooks] Request received: ${req.method} ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find webhooks stuck in processing status for more than 10 minutes
    const cutoffTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: stuckWebhooks, error: fetchError } = await supabase
      .from('garmin_webhook_logs')
      .select('*')
      .eq('status', 'processing')
      .lt('created_at', cutoffTime)
      .limit(50);

    if (fetchError) {
      console.error('[reprocess-stuck-webhooks] Error fetching stuck webhooks:', fetchError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch stuck webhooks',
        details: fetchError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!stuckWebhooks || stuckWebhooks.length === 0) {
      console.log('[reprocess-stuck-webhooks] No stuck webhooks found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No stuck webhooks found',
        processed: 0,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[reprocess-stuck-webhooks] Found ${stuckWebhooks.length} stuck webhooks`);
    
    let reprocessedCount = 0;
    let failedCount = 0;

    // Process each stuck webhook
    for (const webhook of stuckWebhooks) {
      try {
        console.log(`[reprocess-stuck-webhooks] Reprocessing webhook ${webhook.id}`);
        
        if (webhook.webhook_type === 'activity_notification') {
          // Trigger activities sync for this user
          const { error: syncError } = await supabase.functions.invoke('sync-garmin-activities', {
            body: {
              webhook_triggered: true,
              user_access_token: webhook.payload?.userAccessToken,
              garmin_user_id: webhook.garmin_user_id
            }
          });

          if (syncError) {
            console.error(`[reprocess-stuck-webhooks] Failed to reprocess webhook ${webhook.id}:`, syncError);
            failedCount++;
            
            // Update webhook status to failed
            await supabase
              .from('garmin_webhook_logs')
              .update({ 
                status: 'sync_failed',
                error_message: `Reprocessing failed: ${syncError.message}`,
                processed_at: new Date().toISOString()
              })
              .eq('id', webhook.id);
          } else {
            console.log(`[reprocess-stuck-webhooks] Successfully reprocessed webhook ${webhook.id}`);
            reprocessedCount++;
            
            // Update webhook status to reprocessed
            await supabase
              .from('garmin_webhook_logs')
              .update({ 
                status: 'sync_triggered',
                processed_at: new Date().toISOString()
              })
              .eq('id', webhook.id);
          }
        } else if (webhook.webhook_type === 'activity_details_notification') {
          // Trigger activity details sync for this user
          const { error: syncError } = await supabase.functions.invoke('sync-garmin-activity-details', {
            body: {
              webhook_triggered: true,
              garmin_user_id: webhook.garmin_user_id,
              activity_notifications: [webhook.payload]
            }
          });

          if (syncError) {
            console.error(`[reprocess-stuck-webhooks] Failed to reprocess activity details webhook ${webhook.id}:`, syncError);
            failedCount++;
            
            // Update webhook status to failed
            await supabase
              .from('garmin_webhook_logs')
              .update({ 
                status: 'sync_failed',
                error_message: `Reprocessing failed: ${syncError.message}`,
                processed_at: new Date().toISOString()
              })
              .eq('id', webhook.id);
          } else {
            console.log(`[reprocess-stuck-webhooks] Successfully reprocessed activity details webhook ${webhook.id}`);
            reprocessedCount++;
            
            // Update webhook status to success
            await supabase
              .from('garmin_webhook_logs')
              .update({ 
                status: 'success',
                processed_at: new Date().toISOString()
              })
              .eq('id', webhook.id);
          }
        } else {
          console.log(`[reprocess-stuck-webhooks] Skipping webhook ${webhook.id} with type ${webhook.webhook_type}`);
          
          // Mark as failed with reason
          await supabase
            .from('garmin_webhook_logs')
            .update({ 
              status: 'sync_failed',
              error_message: `Unsupported webhook type for reprocessing: ${webhook.webhook_type}`,
              processed_at: new Date().toISOString()
            })
            .eq('id', webhook.id);
          
          failedCount++;
        }
      } catch (error) {
        console.error(`[reprocess-stuck-webhooks] Unexpected error processing webhook ${webhook.id}:`, error);
        failedCount++;
        
        // Update webhook status to failed
        await supabase
          .from('garmin_webhook_logs')
          .update({ 
            status: 'sync_failed',
            error_message: `Unexpected error during reprocessing: ${error.message}`,
            processed_at: new Date().toISOString()
          })
          .eq('id', webhook.id);
      }
    }

    const response = {
      success: true,
      message: `Reprocessed ${reprocessedCount} stuck webhooks, ${failedCount} failed`,
      total_found: stuckWebhooks.length,
      reprocessed: reprocessedCount,
      failed: failedCount,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };

    console.log('[reprocess-stuck-webhooks] Completed:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[reprocess-stuck-webhooks] Unexpected error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Unexpected error during reprocessing',
      details: error.message,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});