import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GarminTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
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

    const garminClientId = Deno.env.get('GARMIN_CLIENT_ID')!;
    const garminClientSecret = Deno.env.get('GARMIN_CLIENT_SECRET')!;

    console.log('[direct-token-renewal] Starting direct token renewal process');

    // Find expired tokens with valid refresh tokens
    const { data: expiredTokens, error: queryError } = await supabase
      .from('garmin_tokens')
      .select('user_id, garmin_user_id, refresh_token, expires_at, refresh_token_expires_at')
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .not('refresh_token', 'is', null);

    if (queryError) {
      console.error('[direct-token-renewal] Error querying expired tokens:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query expired tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[direct-token-renewal] Found ${expiredTokens?.length || 0} expired tokens to renew`);

    const results = [];

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
      try {
        // Check if refresh token is still valid
        if (token.refresh_token_expires_at && new Date(token.refresh_token_expires_at) <= new Date()) {
          results.push({
            user_id: token.user_id,
            status: 'skipped',
            message: 'Refresh token expired'
          });
          continue;
        }

        console.log(`[direct-token-renewal] Processing user: ${token.user_id}`);

        // Decode refresh token if it's in base64 format
        let refreshTokenValue = token.refresh_token;
        if (token.refresh_token && token.refresh_token.length > 100) {
          try {
            const decodedSecret = atob(token.refresh_token);
            const secretData = JSON.parse(decodedSecret);
            if (secretData.refreshTokenValue) {
              refreshTokenValue = secretData.refreshTokenValue;
              console.log(`[direct-token-renewal] Decoded refresh token for user: ${token.user_id}`);
            }
          } catch (error) {
            console.log(`[direct-token-renewal] Token not base64 encoded for user: ${token.user_id}`);
          }
        }

        console.log(`[direct-token-renewal] Using refresh token: ${refreshTokenValue.substring(0, 8)}...`);

        // Call Garmin API directly to refresh token
        const tokenRequestBody = new URLSearchParams({
          client_id: garminClientId.replace(/^\+/, ''),
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
          console.error(`[direct-token-renewal] Token refresh failed for user ${token.user_id}:`, errorText);
          results.push({
            user_id: token.user_id,
            status: 'failed',
            message: `Token refresh failed: ${tokenResponse.status} ${errorText}`
          });
          continue;
        }

        const tokenData: GarminTokenResponse = await tokenResponse.json();
        console.log(`[direct-token-renewal] Successfully refreshed token for user: ${token.user_id}`);

        // Calculate expiration times
        const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
        const refreshExpiresAt = new Date(Date.now() + (89 * 24 * 60 * 60 * 1000)); // 89 days

        // Update token in database
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
          console.log(`[direct-token-renewal] Successfully updated token for user: ${token.user_id}`);
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

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log(`[direct-token-renewal] Renewal complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        message: `Direct token renewal complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`,
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
    console.error('[direct-token-renewal] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});