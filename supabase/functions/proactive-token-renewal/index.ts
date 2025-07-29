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

    const results = {
      checked: 0,
      renewed: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Find tokens that expire in the next 2 hours
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    
    const { data: expiring_tokens, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('id, user_id, garmin_user_id, access_token, token_secret, expires_at, refresh_token_expires_at')
      .eq('is_active', true)
      .not('token_secret', 'is', null) // Must have refresh token
      .lt('expires_at', twoHoursFromNow)
      .gt('refresh_token_expires_at', new Date().toISOString()) // Refresh token not expired
      .limit(20); // Process in batches

    if (tokenError) {
      console.error('[proactive-token-renewal] Error fetching expiring tokens:', tokenError);
      throw tokenError;
    }

    if (!expiring_tokens || expiring_tokens.length === 0) {
      console.log('[proactive-token-renewal] No tokens need renewal');
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens need renewal',
        ...results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[proactive-token-renewal] Found ${expiring_tokens.length} tokens that need renewal`);

    for (const token of expiring_tokens) {
      try {
        results.checked++;
        
        console.log(`[proactive-token-renewal] Attempting to renew token for user ${token.user_id}`);
        
        // Call the garmin-oauth function to refresh the token
        const { data: refreshResult, error: refreshError } = await supabase.functions.invoke('garmin-oauth', {
          body: {
            refresh_token: token.token_secret,
            grant_type: 'refresh_token',
            user_id: token.user_id
          }
        });

        if (refreshError) {
          console.error(`[proactive-token-renewal] Renewal failed for user ${token.user_id}:`, refreshError);
          results.errors.push(`Renewal failed for user ${token.user_id}: ${refreshError.message}`);
          results.failed++;
          
          // Update mapping to mark as needs reauth if refresh token is expired
          if (refreshError.message?.includes('refresh_token')) {
            await supabase
              .from('garmin_user_mapping')
              .update({
                is_active: false,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', token.user_id);
          }
        } else if (refreshResult?.success) {
          console.log(`[proactive-token-renewal] Successfully renewed token for user ${token.user_id}`);
          results.renewed++;
          
          // Update mapping last_seen_at
          await supabase
            .from('garmin_user_mapping')
            .update({
              last_seen_at: new Date().toISOString(),
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', token.user_id);
        } else {
          console.warn(`[proactive-token-renewal] Unexpected renewal result for user ${token.user_id}:`, refreshResult);
          results.failed++;
        }
        
      } catch (renewalError) {
        console.error(`[proactive-token-renewal] Error renewing token for user ${token.user_id}:`, renewalError);
        results.failed++;
        results.errors.push(`Renewal error for user ${token.user_id}: ${renewalError.message}`);
      }
    }

    console.log(`[proactive-token-renewal] Renewal completed. Checked: ${results.checked}, Renewed: ${results.renewed}, Failed: ${results.failed}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Proactive token renewal completed',
      ...results
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