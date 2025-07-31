import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const garminClientId = Deno.env.get('GARMIN_CLIENT_ID');
    const garminClientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');

    console.log('[direct-token-renewal] Starting proactive token renewal process');

    // Query for tokens that will expire within 4 hours
    const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const { data: expiredTokens, error: queryError } = await supabase
      .from('garmin_tokens')
      .select('user_id, garmin_user_id, refresh_token, expires_at, refresh_token_expires_at')
      .eq('is_active', true)
      .lt('expires_at', fourHoursFromNow)
      .not('refresh_token', 'is', null);

    if (queryError) {
      console.error('[direct-token-renewal] Error querying expired tokens:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to query expired tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];
    if (!expiredTokens || expiredTokens.length === 0) {
      return new Response(JSON.stringify({
        message: 'No tokens expiring within 4 hours found',
        results
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    for (const token of expiredTokens) {
      try {
        if (token.refresh_token_expires_at && new Date(token.refresh_token_expires_at) <= new Date()) {
          results.push({
            user_id: token.user_id,
            status: 'skipped',
            message: 'Refresh token expired'
          });
          continue;
        }

        const refreshTokenValue = token.refresh_token;

        const tokenRequestBody = new URLSearchParams({
          client_id: garminClientId,
          client_secret: garminClientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshTokenValue
        });

        const tokenResponse = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: tokenRequestBody
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(`[direct-token-renewal] Token refresh failed: ${tokenResponse.status} ${errorText}`);
          results.push({
            user_id: token.user_id,
            status: 'failed',
            message: `Token refresh failed: ${tokenResponse.status} ${errorText}`
          });
          continue;
        }

        const tokenData = await tokenResponse.json();

        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        const refreshExpiresAt = new Date(Date.now() + tokenData.refresh_token_expires_in * 1000);

        const { error: updateError } = await supabase
          .from('garmin_tokens')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt.toISOString(),
            refresh_token_expires_at: refreshExpiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', token.user_id)
          .eq('is_active', true);

        if (updateError) {
          console.error(`[direct-token-renewal] Error updating token for user ${token.user_id}:`, updateError);
          results.push({
            user_id: token.user_id,
            status: 'failed',
            message: 'Failed to update token in database'
          });
        } else {
          console.log(`[direct-token-renewal] Token updated for user: ${token.user_id}`);
          results.push({
            user_id: token.user_id,
            status: 'success',
            message: 'Token renewed successfully'
          });
        }
      } catch (error) {
        console.error(`[direct-token-renewal] Exception processing user ${token.user_id}:`, error);
        results.push({
          user_id: token.user_id,
          status: 'failed',
          message: `Exception: ${error.message}`
        });
      }
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length
    };

    return new Response(JSON.stringify({
      message: `Direct token renewal complete: ${summary.success} success, ${summary.failed} failed, ${summary.skipped} skipped`,
      results,
      summary
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[direct-token-renewal] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});