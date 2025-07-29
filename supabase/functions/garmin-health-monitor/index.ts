import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[garmin-health-monitor] ===== FUNCTION STARTED =====');
  console.log('[garmin-health-monitor] Method:', req.method);
  console.log('[garmin-health-monitor] URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[garmin-health-monitor] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // FASE 4: Monitor function calls and detect anomalies
    console.log('[garmin-health-monitor] Monitoring Garmin OAuth function calls...');
    
    // Check for excessive calls in the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: recentCalls, error: callsError } = await supabase
      .from('garmin_function_calls')
      .select('id, user_id, created_at, success')
      .eq('function_name', 'garmin-oauth')
      .gte('created_at', tenMinutesAgo);

    if (callsError) {
      console.error('[garmin-health-monitor] Error fetching function calls:', callsError);
      throw callsError;
    }

    console.log(`[garmin-health-monitor] Found ${recentCalls?.length || 0} calls in last 10 minutes`);

    // Analyze patterns
    const callsByUser = new Map();
    const totalCalls = recentCalls?.length || 0;
    let suspiciousUsers = [];

    if (recentCalls) {
      for (const call of recentCalls) {
        const userId = call.user_id || 'anonymous';
        if (!callsByUser.has(userId)) {
          callsByUser.set(userId, []);
        }
        callsByUser.get(userId).push(call);
      }

      // Find users with excessive calls (more than 20 in 10 minutes)
      for (const [userId, calls] of callsByUser.entries()) {
        if (calls.length > 20) {
          suspiciousUsers.push({
            userId,
            callCount: calls.length,
            failedCalls: calls.filter(c => !c.success).length
          });
        }
      }
    }

    // Check current rate limits
    const { data: rateLimits, error: rateLimitError } = await supabase
      .from('garmin_rate_limits')
      .select('user_id, attempts, last_attempt')
      .gte('last_attempt', tenMinutesAgo);

    if (rateLimitError) {
      console.error('[garmin-health-monitor] Error fetching rate limits:', rateLimitError);
    }

    // Check for blocked tokens
    const { data: blockedTokens, error: blockedError } = await supabase
      .from('garmin_blocked_tokens')
      .select('id, token_hash, user_id, blocked_at, reason')
      .gte('blocked_at', tenMinutesAgo);

    if (blockedError) {
      console.error('[garmin-health-monitor] Error fetching blocked tokens:', blockedError);
    }

    // Generate health report
    const healthReport = {
      timestamp: new Date().toISOString(),
      status: totalCalls > 100 ? 'critical' : totalCalls > 50 ? 'warning' : 'healthy',
      metrics: {
        totalCallsLast10Min: totalCalls,
        uniqueUsers: callsByUser.size,
        suspiciousUsers: suspiciousUsers.length,
        rateLimitedUsers: rateLimits?.length || 0,
        newlyBlockedTokens: blockedTokens?.length || 0
      },
      alerts: [],
      recommendations: []
    };

    // Generate alerts and recommendations
    if (totalCalls > 100) {
      healthReport.alerts.push('CRITICAL: Excessive function calls detected');
      healthReport.recommendations.push('Consider implementing stricter rate limiting');
    }

    if (suspiciousUsers.length > 0) {
      healthReport.alerts.push(`WARNING: ${suspiciousUsers.length} users with suspicious activity`);
      healthReport.recommendations.push('Review and potentially block suspicious users');
    }

    if (totalCalls > 50 && callsByUser.size < 3) {
      healthReport.alerts.push('WARNING: High calls from few users - potential loop detected');
      healthReport.recommendations.push('Investigate specific user patterns and implement circuit breakers');
    }

    // Log detailed information for suspicious users
    for (const suspUser of suspiciousUsers) {
      console.log(`[garmin-health-monitor] SUSPICIOUS USER: ${suspUser.userId} - ${suspUser.callCount} calls (${suspUser.failedCalls} failed)`);
    }

    // Store health report
    const { error: reportError } = await supabase
      .from('garmin_health_reports')
      .insert({
        report_data: healthReport,
        status: healthReport.status,
        total_calls: totalCalls,
        unique_users: callsByUser.size,
        suspicious_users: suspiciousUsers.length,
        created_at: new Date().toISOString()
      });

    if (reportError) {
      console.error('[garmin-health-monitor] Error storing health report:', reportError);
    }

    console.log('[garmin-health-monitor] Health report generated:', {
      status: healthReport.status,
      totalCalls,
      uniqueUsers: callsByUser.size,
      alerts: healthReport.alerts.length
    });

    return new Response(JSON.stringify({
      success: true,
      healthReport,
      suspiciousUsers,
      details: {
        rateLimits: rateLimits?.length || 0,
        blockedTokens: blockedTokens?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[garmin-health-monitor] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});