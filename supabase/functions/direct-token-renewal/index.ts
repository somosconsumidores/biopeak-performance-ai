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
      .select('user_id, refresh_token, expires_at, refresh_token_expires_at')
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .not('refresh_token', 'is', null);

    if (queryError) {
      console.error('[direct-token-renewal] DB query error:', queryError);
      return new Response(JSON.stringify({ error: 'DB query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];
    for (const token of expiredTokens || []) {
      const result = { user_id: token.user_id };

      if (token.refresh_token_expires_at && new Date(token.refresh_token_expires_at) <= new Date()) {
        result.status = 'skipped';
        result.message = 'Refresh token expired';
        results.push(result);
        continue;
      }

      let refreshToken = token.refresh_token;
      try {
        const decoded = atob(refreshToken);
        const parsed = JSON.parse(decoded);
        if (parsed.refreshTokenValue) {
          refreshToken = parsed.refreshTokenValue;
        }
      } catch (_) {
        // token is already raw, ignore
      }

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: garminClientId,
        client_secret: garminClientSecret,
        refresh_token: refreshToken
      });

      const response = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params
      });

      if (!response.ok) {
        const errorText = await response.text();
        result.status = 'failed';
        result.message = `Token refresh failed: ${response.status} ${errorText}`;
        console.error(`[direct-token-renewal] ${result.message}`);
        results.push(result);
        continue;
      }

      const newToken = await response.json();
      const expiresAt = new Date(Date.now() + newToken.expires_in * 1000);
      const refreshExpiresAt = new Date(Date.now() + 89 * 24 * 60 * 60 * 1000);

      const { error: updateError } = await supabase
        .from('garmin_tokens')
        .update({
          access_token: newToken.access_token,
          refresh_token: newToken.refresh_token,
          expires_at: expiresAt.toISOString(),
          refresh_token_expires_at: refreshExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', token.user_id)
        .eq('is_active', true);

      if (updateError) {
        result.status = 'failed';
        result.message = 'Database update failed';
        console.error(`[direct-token-renewal] ${result.message}:`, updateError);
      } else {
        result.status = 'success';
        result.message = 'Token refreshed and updated';
      }

      results.push(result);
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[direct-token-renewal] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected server error', details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});