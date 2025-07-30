import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function tryDecodeToken(rawToken) {
  let decoded = rawToken;
  try {
    const once = JSON.parse(atob(decoded));
    if (once.refreshTokenValue && typeof once.refreshTokenValue === 'string') {
      decoded = once.refreshTokenValue;
      try {
        const twice = JSON.parse(atob(decoded));
        if (twice.refreshTokenValue && typeof twice.refreshTokenValue === 'string') {
          decoded = twice.refreshTokenValue;
          console.log('[decode] Token decoded twice');
        } else {
          console.log('[decode] Token decoded once');
        }
      } catch {
        console.log('[decode] Token decoded once (second decode failed)');
      }
    }
  } catch {
    console.log('[decode] Token not base64 encoded (using raw)');
  }
  return decoded;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    const clientId = Deno.env.get('GARMIN_CLIENT_ID')?.replace(/^\+/, '') || '';
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET') || '';

    console.log('[direct-token-renewal] Starting token renewal');

    const { data: tokens, error: queryError } = await supabase
      .from('garmin_tokens')
      .select('user_id, refresh_token, refresh_token_expires_at, expires_at')
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .not('refresh_token', 'is', null);

    if (queryError) {
      console.error('[direct-token-renewal] Query error:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to query tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const token of tokens || []) {
      const result = { user_id: token.user_id, status: 'failed', message: '' };

      if (token.refresh_token_expires_at && new Date(token.refresh_token_expires_at) <= new Date()) {
        result.status = 'skipped';
        result.message = 'Refresh token expired';
        results.push(result);
        continue;
      }

      let refreshTokenValue = tryDecodeToken(token.refresh_token);
      console.log(`[refresh] Using token: ${refreshTokenValue.substring(0, 8)}...`);

      try {
        const body = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshTokenValue
        });

        const response = await fetch('https://connect.garmin.com/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body
        });

        if (!response.ok) {
          const err = await response.text();
          console.error(`[direct-token-renewal] Token refresh failed: ${response.status} ${err}`);
          result.message = `Token refresh failed: ${response.status}`;
          results.push(result);
          continue;
        }

        const tokenData = await response.json();
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        const refreshExpiresAt = new Date(Date.now() + 89 * 24 * 60 * 60 * 1000);

        const { error: updateError } = await supabase.from('garmin_tokens').update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
          refresh_token_expires_at: refreshExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        }).eq('user_id', token.user_id).eq('is_active', true);

        if (updateError) {
          console.error(`[direct-token-renewal] DB update failed:`, updateError);
          result.message = 'Failed to update token';
        } else {
          result.status = 'success';
          result.message = 'Token updated';
        }
      } catch (err) {
        console.error(`[direct-token-renewal] Exception:`, err);
        result.message = err.message;
      }

      results.push(result);
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[direct-token-renewal] Fatal error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});