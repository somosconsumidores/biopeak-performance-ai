import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RenewalResult {
  user_id: string;
  status: 'success' | 'failed' | 'skipped';
  message: string;
  error?: string;
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

    // Parse request body to check if specific user_id is provided
    const { user_id } = await req.json().catch(() => ({ user_id: null }));

    console.log(`[force-token-renewal] Starting renewal process${user_id ? ` for user: ${user_id}` : ' for all expired tokens'}`);

    // Find expired tokens with valid refresh tokens
    let query = supabase
      .from('garmin_tokens')
      .select('user_id, garmin_user_id, refresh_token, expires_at, refresh_token_expires_at')
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .not('refresh_token', 'is', null);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data: expiredTokens, error: queryError } = await query;

    if (queryError) {
      console.error('[force-token-renewal] Error querying expired tokens:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query expired tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[force-token-renewal] Found ${expiredTokens?.length || 0} expired tokens to renew`);

    const results: RenewalResult[] = [];

    if (!expiredTokens || expiredTokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No expired tokens found',
          results: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each expired token
    for (const token of expiredTokens) {
      const result: RenewalResult = {
        user_id: token.user_id,
        status: 'failed',
        message: ''
      };

      try {
        // Check if refresh token is still valid
        if (token.refresh_token_expires_at && new Date(token.refresh_token_expires_at) <= new Date()) {
          result.status = 'skipped';
          result.message = 'Refresh token expired';
          results.push(result);
          continue;
        }

        console.log(`[force-token-renewal] Renewing token for user: ${token.user_id}`);

        // Decode refresh token if it's in base64 format (legacy)
        let refreshTokenValue = token.refresh_token;
        if (token.refresh_token && token.refresh_token.length > 100) {
          try {
            const decodedSecret = atob(token.refresh_token);
            const secretData = JSON.parse(decodedSecret);
            if (secretData.refreshTokenValue) {
              refreshTokenValue = secretData.refreshTokenValue;
              console.log(`[force-token-renewal] Decoded base64 refresh token for user: ${token.user_id}`);
            }
          } catch (error) {
            console.log(`[force-token-renewal] Using refresh token as-is for user ${token.user_id} (not base64)`);
          }
        }

        // Call garmin-oauth function to renew the token with service role auth
        const { data: renewalResponse, error: renewalError } = await supabase.functions.invoke('garmin-oauth', {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: {
            refresh_token: refreshTokenValue,
            grant_type: 'refresh_token',
            force_renewal: true,
            user_id: token.user_id
          }
        });

        if (renewalError) {
          console.error(`[force-token-renewal] Renewal error for user ${token.user_id}:`, renewalError);
          result.error = renewalError.message;
          result.message = 'Token renewal failed';
        } else if (renewalResponse?.success) {
          console.log(`[force-token-renewal] Successfully renewed token for user: ${token.user_id}`);
          result.status = 'success';
          result.message = 'Token renewed successfully';
        } else {
          console.log(`[force-token-renewal] Renewal failed for user ${token.user_id}:`, renewalResponse);
          result.error = renewalResponse?.error || 'Unknown error';
          result.message = 'Token renewal failed';
        }

      } catch (error) {
        console.error(`[force-token-renewal] Exception renewing token for user ${token.user_id}:`, error);
        result.error = error.message;
        result.message = 'Exception during token renewal';
      }

      results.push(result);
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log(`[force-token-renewal] Renewal complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        message: `Token renewal complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failedCount,
          skipped: skippedCount
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[force-token-renewal] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});