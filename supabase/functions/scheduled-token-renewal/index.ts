import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[scheduled-token-renewal] Starting scheduled token renewal check...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find tokens expiring in the next 2 hours
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    
    const { data: expiringTokens, error: queryError } = await supabase
      .from('garmin_tokens')
      .select('user_id, expires_at, refresh_token, refresh_token_expires_at')
      .eq('is_active', true)
      .not('refresh_token', 'is', null)
      .lt('expires_at', twoHoursFromNow)
      .gt('refresh_token_expires_at', new Date().toISOString());

    if (queryError) {
      console.error('[scheduled-token-renewal] Error querying expiring tokens:', queryError);
      throw queryError;
    }

    console.log(`[scheduled-token-renewal] Found ${expiringTokens?.length || 0} tokens expiring soon`);

    if (!expiringTokens || expiringTokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No tokens need renewal at this time',
          tokensChecked: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the renewal function for each user
    const renewalResults = [];
    
    for (const token of expiringTokens) {
      try {
        console.log(`[scheduled-token-renewal] Renewing token for user ${token.user_id}`);
        
        const { data: renewalResult, error: renewalError } = await supabase.functions.invoke('renew-garmin-token', {
          body: { user_id: token.user_id }
        });

        if (renewalError) {
          console.error(`[scheduled-token-renewal] Error renewing token for user ${token.user_id}:`, renewalError);
          renewalResults.push({
            user_id: token.user_id,
            success: false,
            error: renewalError.message
          });
        } else {
          console.log(`[scheduled-token-renewal] Successfully renewed token for user ${token.user_id}`);
          renewalResults.push({
            user_id: token.user_id,
            success: true,
            result: renewalResult
          });
        }
      } catch (error) {
        console.error(`[scheduled-token-renewal] Exception renewing token for user ${token.user_id}:`, error);
        renewalResults.push({
          user_id: token.user_id,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = renewalResults.filter(r => r.success).length;
    const failureCount = renewalResults.filter(r => !r.success).length;

    console.log(`[scheduled-token-renewal] Renewal completed: ${successCount} success, ${failureCount} failures`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Token renewal completed: ${successCount} success, ${failureCount} failures`,
        tokensChecked: expiringTokens.length,
        results: renewalResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[scheduled-token-renewal] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});