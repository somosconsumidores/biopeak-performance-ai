import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    console.log('[garmin-token-health-monitor] Starting health check...');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get comprehensive token health statistics
    const healthStats = {
      timestamp: new Date().toISOString(),
      tokens: {
        total: 0,
        active: 0,
        expired: 0,
        expiring_soon: 0,
        invalid_refresh: 0
      },
      webhooks: {
        today_total: 0,
        today_no_active_user: 0,
        today_recovered: 0,
        pending_orphaned: 0
      },
      mappings: {
        total: 0,
        active: 0
      }
    };

    // Token statistics
    const { data: tokenStats } = await supabase
      .from('garmin_tokens')
      .select('is_active, expires_at, refresh_token_expires_at');

    if (tokenStats) {
      healthStats.tokens.total = tokenStats.length;
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      
      for (const token of tokenStats) {
        if (token.is_active) {
          healthStats.tokens.active++;
        }
        
        if (token.expires_at && new Date(token.expires_at) <= now) {
          healthStats.tokens.expired++;
        }
        
        if (token.expires_at && new Date(token.expires_at) <= twoHoursFromNow && new Date(token.expires_at) > now) {
          healthStats.tokens.expiring_soon++;
        }
        
        if (token.refresh_token_expires_at && new Date(token.refresh_token_expires_at) <= now) {
          healthStats.tokens.invalid_refresh++;
        }
      }
    }

    // Webhook statistics for today
    const today = new Date().toISOString().split('T')[0];
    
    const { data: webhookStats } = await supabase
      .from('garmin_webhook_logs')
      .select('status')
      .gte('created_at', today + 'T00:00:00.000Z')
      .lt('created_at', today + 'T23:59:59.999Z');

    if (webhookStats) {
      healthStats.webhooks.today_total = webhookStats.length;
      
      for (const webhook of webhookStats) {
        if (webhook.status === 'no_active_user') {
          healthStats.webhooks.today_no_active_user++;
        } else if (webhook.status === 'user_recovered_needs_reauth') {
          healthStats.webhooks.today_recovered++;
        }
      }
    }

    // Orphaned webhooks
    const { data: orphanedStats } = await supabase
      .from('garmin_orphaned_webhooks')
      .select('id')
      .eq('status', 'pending');

    if (orphanedStats) {
      healthStats.webhooks.pending_orphaned = orphanedStats.length;
    }

    // Mapping statistics
    const { data: mappingStats } = await supabase
      .from('garmin_user_mapping')
      .select('is_active');

    if (mappingStats) {
      healthStats.mappings.total = mappingStats.length;
      healthStats.mappings.active = mappingStats.filter(m => m.is_active).length;
    }

    // Health assessment
    const health = {
      overall: 'healthy',
      issues: [] as string[],
      recommendations: [] as string[]
    };

    // Check for issues
    if (healthStats.tokens.expired > 0) {
      health.issues.push(`${healthStats.tokens.expired} expired tokens need cleanup`);
      health.overall = 'warning';
    }

    if (healthStats.tokens.expiring_soon > 5) {
      health.issues.push(`${healthStats.tokens.expiring_soon} tokens expiring within 2 hours`);
      health.recommendations.push('Run proactive token renewal');
      health.overall = 'warning';
    }

    if (healthStats.webhooks.today_no_active_user > 10) {
      health.issues.push(`${healthStats.webhooks.today_no_active_user} webhooks with no active user today`);
      health.overall = 'critical';
    }

    if (healthStats.webhooks.pending_orphaned > 50) {
      health.issues.push(`${healthStats.webhooks.pending_orphaned} pending orphaned webhooks`);
      health.recommendations.push('Run orphaned webhook processor');
      health.overall = 'warning';
    }

    if (healthStats.tokens.invalid_refresh > 0) {
      health.issues.push(`${healthStats.tokens.invalid_refresh} tokens with expired refresh tokens`);
      health.recommendations.push('Users need to reconnect Garmin');
    }

    // Recovery statistics for the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recoveryStats } = await supabase
      .from('garmin_webhook_logs')
      .select('status')
      .eq('status', 'user_recovered_needs_reauth')
      .gte('created_at', sevenDaysAgo);

    const response = {
      success: true,
      health,
      stats: healthStats,
      recovery: {
        last_7_days_recovered: recoveryStats?.length || 0
      },
      actions_available: [
        'run_proactive_renewal',
        'process_orphaned_webhooks',
        'cleanup_expired_tokens',
        'send_reconnection_alerts'
      ]
    };

    console.log('[garmin-token-health-monitor] Health check completed:', health.overall);

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[garmin-token-health-monitor] Fatal error:', error);
    
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