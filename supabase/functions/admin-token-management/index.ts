import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdminTokenResponse {
  success: boolean;
  action: string;
  results: any;
  cron_status?: any;
  message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json();
    console.log(`[admin-token-management] Action requested: ${action}`);

    let response: AdminTokenResponse;

    switch (action) {
      case 'force_renew_expired':
        console.log('[admin-token-management] Forcing renewal of expired tokens...');
        
        const { data: renewalResults, error: renewalError } = await supabase
          .rpc('force_renew_expired_tokens');
        
        if (renewalError) {
          console.error('[admin-token-management] Error forcing renewal:', renewalError);
          throw renewalError;
        }
        
        console.log('[admin-token-management] Renewal results:', renewalResults);
        
        response = {
          success: true,
          action: 'force_renew_expired',
          results: renewalResults,
          message: `Processed ${renewalResults?.length || 0} tokens for renewal`
        };
        break;

      case 'check_cron_status':
        console.log('[admin-token-management] Checking cron job status...');
        
        const { data: cronStatus, error: cronError } = await supabase
          .rpc('get_cron_job_status');
        
        if (cronError) {
          console.error('[admin-token-management] Error checking cron status:', cronError);
          throw cronError;
        }
        
        console.log('[admin-token-management] Cron status:', cronStatus);
        
        response = {
          success: true,
          action: 'check_cron_status',
          results: cronStatus,
          cron_status: cronStatus
        };
        break;

      case 'health_check':
        console.log('[admin-token-management] Performing health check...');
        
        // Check expired tokens
        const { data: expiredTokens, error: expiredError } = await supabase
          .from('garmin_tokens')
          .select('user_id, expires_at, refresh_token_expires_at')
          .eq('is_active', true)
          .lt('expires_at', new Date().toISOString());
        
        if (expiredError) {
          console.error('[admin-token-management] Error checking expired tokens:', expiredError);
          throw expiredError;
        }
        
        // Check orphaned webhooks
        const { data: orphanedWebhooks, error: orphanedError } = await supabase
          .from('garmin_orphaned_webhooks')
          .select('id, status, created_at')
          .eq('status', 'pending');
        
        if (orphanedError) {
          console.error('[admin-token-management] Error checking orphaned webhooks:', orphanedError);
          throw orphanedError;
        }
        
        const healthData = {
          expired_tokens: expiredTokens?.length || 0,
          orphaned_webhooks: orphanedWebhooks?.length || 0,
          timestamp: new Date().toISOString()
        };
        
        console.log('[admin-token-management] Health check results:', healthData);
        
        response = {
          success: true,
          action: 'health_check',
          results: healthData
        };
        break;

      case 'trigger_proactive_renewal':
        console.log('[admin-token-management] Triggering proactive renewal...');
        
        const { data: proactiveData, error: proactiveError } = await supabase.functions
          .invoke('proactive-token-renewal', {
            body: { triggered_by: 'admin_manual' }
          });
        
        if (proactiveError) {
          console.error('[admin-token-management] Error triggering proactive renewal:', proactiveError);
          throw proactiveError;
        }
        
        console.log('[admin-token-management] Proactive renewal result:', proactiveData);
        
        response = {
          success: true,
          action: 'trigger_proactive_renewal',
          results: proactiveData
        };
        break;

      case 'process_orphaned_webhooks':
        console.log('[admin-token-management] Processing orphaned webhooks...');
        
        const { data: webhookData, error: webhookError } = await supabase.functions
          .invoke('process-orphaned-webhooks', {
            body: { triggered_by: 'admin_manual' }
          });
        
        if (webhookError) {
          console.error('[admin-token-management] Error processing orphaned webhooks:', webhookError);
          throw webhookError;
        }
        
        console.log('[admin-token-management] Orphaned webhook processing result:', webhookData);
        
        response = {
          success: true,
          action: 'process_orphaned_webhooks',
          results: webhookData
        };
        break;

      case 'full_system_check':
        console.log('[admin-token-management] Performing full system check and repair...');
        
        // Step 1: Force renew expired tokens
        const { data: fullRenewalResults } = await supabase
          .rpc('force_renew_expired_tokens');
        
        // Step 2: Process orphaned webhooks
        const { data: fullWebhookData } = await supabase.functions
          .invoke('process-orphaned-webhooks', {
            body: { triggered_by: 'full_system_check' }
          });
        
        // Step 3: Get health monitor data
        const { data: fullHealthData } = await supabase.functions
          .invoke('garmin-token-health-monitor', {
            body: { triggered_by: 'full_system_check' }
          });
        
        const fullResults = {
          renewal_results: fullRenewalResults,
          webhook_processing: fullWebhookData,
          health_monitor: fullHealthData,
          timestamp: new Date().toISOString()
        };
        
        console.log('[admin-token-management] Full system check results:', fullResults);
        
        response = {
          success: true,
          action: 'full_system_check',
          results: fullResults,
          message: 'Full system check and repair completed'
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[admin-token-management] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});