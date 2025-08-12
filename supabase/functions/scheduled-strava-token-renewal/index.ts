import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[scheduled-strava-token-renewal] Starting scheduled Strava token renewal check...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find Strava tokens expiring in the next 50 minutes
    const fiftyMinutesFromNow = new Date(Date.now() + 50 * 60 * 1000).toISOString();

    const { data: expiringTokens, error: queryError } = await supabase
      .from('strava_tokens')
      .select('user_id, expires_at, refresh_token')
      .not('refresh_token', 'is', null)
      .lt('expires_at', fiftyMinutesFromNow);

    if (queryError) {
      console.error('[scheduled-strava-token-renewal] Error querying expiring Strava tokens:', queryError);
      throw queryError;
    }

    console.log(`[scheduled-strava-token-renewal] Found ${expiringTokens?.length || 0} Strava tokens expiring soon`);

    if (!expiringTokens || expiringTokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No Strava tokens need renewal at this time',
          tokensChecked: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const renewalResults: Array<{ user_id: string; success: boolean; error?: string; result?: any }> = [];

    for (const token of expiringTokens) {
      try {
        console.log(`[scheduled-strava-token-renewal] Renewing Strava token for user ${token.user_id}`);

        const { data: renewalResult, error: renewalError } = await supabase.functions.invoke('strava-token-refresh', {
          body: { user_id: token.user_id, refresh_token: token.refresh_token },
        });

        if (renewalError) {
          console.error(`[scheduled-strava-token-renewal] Error renewing Strava token for user ${token.user_id}:`, renewalError);
          renewalResults.push({ user_id: token.user_id, success: false, error: (renewalError as any).message ?? String(renewalError) });
        } else {
          console.log(`[scheduled-strava-token-renewal] Successfully renewed Strava token for user ${token.user_id}`);
          renewalResults.push({ user_id: token.user_id, success: true, result: renewalResult });
        }
      } catch (error: any) {
        console.error(`[scheduled-strava-token-renewal] Exception renewing Strava token for user ${token.user_id}:`, error);
        renewalResults.push({ user_id: token.user_id, success: false, error: error?.message ?? String(error) });
      }
    }

    const successCount = renewalResults.filter((r) => r.success).length;
    const failureCount = renewalResults.filter((r) => !r.success).length;

    console.log(`[scheduled-strava-token-renewal] Renewal completed: ${successCount} success, ${failureCount} failures`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Strava token renewal completed: ${successCount} success, ${failureCount} failures` ,
        tokensChecked: expiringTokens.length,
        results: renewalResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[scheduled-strava-token-renewal] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error?.message ?? String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
