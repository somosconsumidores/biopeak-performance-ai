import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  const startTime = new Date().toISOString();
  console.log(`[proactive-token-renewal] === FUNCTION START at ${startTime} ===`);
  console.log(`[proactive-token-renewal] Request method: ${req.method}`);
  console.log(`[proactive-token-renewal] Request URL: ${req.url}`);
  
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      console.log('[proactive-token-renewal] Handling CORS preflight request');
      return new Response(null, { headers: corsHeaders });
    }

    // Environment variables check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('[proactive-token-renewal] Environment check:');
    console.log(`[proactive-token-renewal] - SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
    console.log(`[proactive-token-renewal] - SERVICE_ROLE_KEY: ${serviceRoleKey ? 'SET (length: ' + serviceRoleKey.length + ')' : 'MISSING'}`);

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    console.log('[proactive-token-renewal] Initializing Supabase client...');

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find tokens that expire in the next 1 hour (aligned with cron job)
    const oneHourFromNow = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
    console.log(`[proactive-token-renewal] Looking for tokens expiring before: ${oneHourFromNow}`);
    
    console.log('[proactive-token-renewal] Querying garmin_tokens table...');
    const { data: expiring_tokens, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('user_id, expires_at, refresh_token_expires_at, garmin_user_id')
      .eq('is_active', true)
      .not('token_secret', 'is', null) // Must have refresh token
      .lt('expires_at', oneHourFromNow)
      .gt('refresh_token_expires_at', new Date().toISOString()); // Refresh token not expired

    console.log('[proactive-token-renewal] Query completed. Processing results...');

    if (tokenError) {
      console.error('[proactive-token-renewal] Database query error:', tokenError);
      console.error('[proactive-token-renewal] Error details:', JSON.stringify(tokenError, null, 2));
      throw tokenError;
    }

    console.log(`[proactive-token-renewal] Query results: ${expiring_tokens?.length || 0} tokens found`);
    
    if (expiring_tokens && expiring_tokens.length > 0) {
      console.log('[proactive-token-renewal] Tokens to be renewed:');
      expiring_tokens.forEach((token, index) => {
        console.log(`[proactive-token-renewal] ${index + 1}. User: ${token.user_id}, Garmin ID: ${token.garmin_user_id || 'N/A'}, Expires: ${token.expires_at}`);
      });
    }

    if (!expiring_tokens || expiring_tokens.length === 0) {
      console.log('[proactive-token-renewal] === NO TOKENS NEED RENEWAL - FUNCTION END ===');
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens need renewal',
        checked: 0,
        renewed: 0,
        failed: 0,
        timestamp: new Date().toISOString(),
        execution_time_ms: Date.now() - new Date(startTime).getTime()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[proactive-token-renewal] Found ${expiring_tokens.length} tokens that need renewal`);
    console.log('[proactive-token-renewal] Calling renew-garmin-token function...');
    
    // Call renew-garmin-token function to handle all renewals
    const { data: renewalData, error: renewalError } = await supabase.functions.invoke('renew-garmin-token', {
      body: {} // No user_id parameter = process all eligible tokens
    });

    console.log('[proactive-token-renewal] renew-garmin-token function call completed');

    if (renewalError) {
      console.error('[proactive-token-renewal] Error calling renew-garmin-token:', renewalError);
      console.error('[proactive-token-renewal] Error details:', JSON.stringify(renewalError, null, 2));
      throw renewalError;
    }

    if (!renewalData?.success) {
      console.error('[proactive-token-renewal] renew-garmin-token failed:', renewalData?.error);
      console.error('[proactive-token-renewal] Full renewal response:', JSON.stringify(renewalData, null, 2));
      throw new Error(renewalData?.error || 'Token renewal failed');
    }

    console.log('[proactive-token-renewal] Token renewal completed successfully');
    console.log('[proactive-token-renewal] Renewal summary:', JSON.stringify(renewalData.summary, null, 2));
    console.log(`[proactive-token-renewal] === FUNCTION END - SUCCESS at ${new Date().toISOString()} ===`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Proactive token renewal completed',
      summary: renewalData.summary,
      renewal_details: renewalData,
      timestamp: new Date().toISOString(),
      execution_time_ms: Date.now() - new Date(startTime).getTime()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[proactive-token-renewal] === FATAL ERROR ===');
    console.error('[proactive-token-renewal] Error message:', error.message);
    console.error('[proactive-token-renewal] Error stack:', error.stack);
    console.error('[proactive-token-renewal] Error type:', error.constructor.name);
    console.error(`[proactive-token-renewal] === FUNCTION END - ERROR at ${new Date().toISOString()} ===`);
    
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