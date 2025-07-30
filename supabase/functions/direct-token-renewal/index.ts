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
    const garminClientId = Deno.env.get('GARMIN_CLIENT_ID');
    const garminClientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[direct-token-renewal] Starting token renewal process');

    const { data: expiredTokens, error: queryError } = await supabase
      .from('garmin_tokens')
      .select('user_id, garmin_user_id, refresh_token, expires_at, refresh_token_expires_at')
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .not('refresh_token', 'is', null);

    if (queryError) {
      console.error('[direct-token-renewal] Query error:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to query expired tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const token of expiredTokens || []) {
      try {
        if (token.refresh_token_expires_at && new Date(token.refresh_token_expires_at) <= new Date()) {
          results.push({ user_id: token.user_id, status: 'skipped', message: 'Refresh token expired' });
          continue;
        }

        console.log(`[direct-token-renewal] Processing user: ${token.user_id}`);

        let refreshTokenValue = token.refresh_token;

        try {
          // decode uma ou duas vezes, se necessário
          const firstDecoded = JSON.parse(atob(refreshTokenValue));
          if (firstDecoded.refreshTokenValue) {
            refreshTokenValue = firstDecoded.refreshTokenValue;
            console.log(`[decode] Token decoded once`);
          }

          if (refreshTokenValue.length > 36) {
            const secondDecoded = JSON.parse(atob(refreshTokenValue));
            if (secondDecoded.refreshTokenValue) {
              refreshTokenValue = secondDecoded.refreshTokenValue;
              console.log(`[decode] Token decoded twice`);
            }
          }
        } catch (_) {
          console.log(`[decode] Token is raw or invalid base64, using as-is`);
        }

        console.log(`[direct-token-renewal] Final refresh_token used: ${refreshTokenValue.substring(0, 8)}...`);

        const tokenRequestBody = new URLSearchParams({
          client_id: garminClientId.replace(/^\+/, ''),
          client_secret: garminClientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshTokenValue
        });

        const tokenResponse = await fetch('https://connect.garmin.com/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: tokenRequestBody
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(`[direct-token-renewal] Token refresh failed for user ${token.user_id}:`, errorText);
          results.push({ user_id: token.user_id, status: 'failed', message: `Token refresh failed: ${errorText}` });
          continue;
        }

        const tokenData = await tokenResponse.json();
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        const refreshExpiresAt = new Date(Date.now() + 89 * 24 * 60 * 60 * 1000); // 89 dias

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
          console.error(`[direct-token-renewal] DB update error for user ${token.user_id}:`, updateError);
          results.push({ user_id: token.user_id, status: 'failed', message: 'DB update failed' });
        } else {
          console.log(`[direct-token-renewal] Successfully updated token for user ${token.user_id}`);
          results.push({ user_id: token.user_id, status: 'success', message: 'Token renewed successfully' });
        }
      } catch (error) {
        console.error(`[direct-token-renewal] Exception for user ${token.user_id}:`, error);
        results.push({ user_id: token.user_id, status: 'failed', message: `Exception: ${error.message}` });
      }
    }

    const summary = {
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length
    };

    console.log(`[direct-token-renewal] Done: ${summary.success} success, ${summary.failed} failed, ${summary.skipped} skipped`);

    return new Response(JSON.stringify({
      message: 'Token renewal completed',
      results,
      summary,
      total: results.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[direct-token-renewal] Fatal error:', error);
    return new Response(JSON.stringify({
      error: 'Internal error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});