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

    console.log('[renew-garmin-token] Starting token renewal process');

    // Parse request body for optional user_id parameter
    let targetUserId = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id;
    } catch {
      // No body or invalid JSON, proceed without user filter
    }

    // Build query for tokens to renew
    let query = supabase
      .from('garmin_tokens')
      .select('user_id, garmin_user_id, refresh_token, expires_at, refresh_token_expires_at')
      .eq('is_active', true)
      .not('refresh_token', 'is', null);

    // Add user filter if specified
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
      console.log(`[renew-garmin-token] Targeting specific user: ${targetUserId}`);
    }

    const { data: tokens, error: queryError } = await query;

    if (queryError) {
      console.error('[renew-garmin-token] Error querying tokens:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to query tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: targetUserId ? `No tokens found for user ${targetUserId}` : 'No tokens found to renew',
        results,
        summary: { total: 0, success: 0, failed: 0, skipped: 0 }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    for (const token of tokens) {
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
          console.error(`[renew-garmin-token] Token refresh failed: ${tokenResponse.status} ${errorText}`);
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
          console.error(`[renew-garmin-token] Error updating token for user ${token.user_id}:`, updateError);
          results.push({
            user_id: token.user_id,
            status: 'failed',
            message: 'Failed to update token in database'
          });
        } else {
          console.log(`[renew-garmin-token] Token updated for user: ${token.user_id}`);
          results.push({
            user_id: token.user_id,
            status: 'success',
            message: 'Token renewed successfully'
          });
        }
      } catch (error) {
        console.error(`[renew-garmin-token] Exception processing user ${token.user_id}:`, error);
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
      success: true,
      message: `Token renewal complete: ${summary.success} success, ${summary.failed} failed, ${summary.skipped} skipped`,
      results,
      summary
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[renew-garmin-token] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});