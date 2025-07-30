import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    console.log('[proactive-token-renewal] Starting proactive token renewal...');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find tokens that expire in the next 2 hours
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    
    const { data: expiring_tokens, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('user_id')
      .eq('is_active', true)
      .not('token_secret', 'is', null) // Must have refresh token
      .lt('expires_at', twoHoursFromNow)
      .gt('refresh_token_expires_at', new Date().toISOString()); // Refresh token not expired

    if (tokenError) {
      console.error('[proactive-token-renewal] Error fetching expiring tokens:', tokenError);
      throw tokenError;
    }

    if (!expiring_tokens || expiring_tokens.length === 0) {
      console.log('[proactive-token-renewal] No tokens need renewal');
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens need renewal',
        checked: 0,
        renewed: 0,
        failed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[proactive-token-renewal] Found ${expiring_tokens.length} tokens that need renewal`);
    
    // Call renew-garmin-token function to handle all renewals
    const { data: renewalData, error: renewalError } = await supabase.functions.invoke('renew-garmin-token', {
      body: {} // No user_id parameter = process all eligible tokens
    });

    if (renewalError) {
      console.error('[proactive-token-renewal] Error calling renew-garmin-token:', renewalError);
      throw renewalError;
    }

    if (!renewalData?.success) {
      console.error('[proactive-token-renewal] renew-garmin-token failed:', renewalData?.error);
      throw new Error(renewalData?.error || 'Token renewal failed');
    }

    console.log('[proactive-token-renewal] Token renewal completed:', renewalData.summary);

    return new Response(JSON.stringify({
      success: true,
      message: 'Proactive token renewal completed',
      summary: renewalData.summary,
      renewal_details: renewalData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[proactive-token-renewal] Fatal error:', error);
    
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