import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  const startTime = new Date().toISOString();
  console.log(`[renew-garmin-token] === FUNCTION START at ${startTime} ===`);
  console.log(`[renew-garmin-token] Request method: ${req.method}`);
  
  if (req.method === 'OPTIONS') {
    console.log('[renew-garmin-token] Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment variables check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const garminClientId = Deno.env.get('GARMIN_CLIENT_ID');
    const garminClientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');
    
    console.log('[renew-garmin-token] Environment check:');
    console.log(`[renew-garmin-token] - SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
    console.log(`[renew-garmin-token] - SERVICE_ROLE_KEY: ${supabaseKey ? 'SET' : 'MISSING'}`);
    console.log(`[renew-garmin-token] - GARMIN_CLIENT_ID: ${garminClientId ? 'SET' : 'MISSING'}`);
    console.log(`[renew-garmin-token] - GARMIN_CLIENT_SECRET: ${garminClientSecret ? 'SET' : 'MISSING'}`);

    if (!supabaseUrl || !supabaseKey || !garminClientId || !garminClientSecret) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[renew-garmin-token] Starting token renewal process');

    // Parse request body for optional user_id parameter
    let targetUserId = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id;
      console.log(`[renew-garmin-token] Request body parsed, user_id: ${targetUserId || 'not specified'}`);
    } catch {
      console.log('[renew-garmin-token] No valid JSON body, proceeding without user filter');
    }

    // Build query for tokens to renew
    console.log('[renew-garmin-token] Building database query...');
    let query = supabase
      .from('garmin_tokens')
      .select('user_id, garmin_user_id, refresh_token, expires_at, refresh_token_expires_at')
      .eq('is_active', true)
      .not('refresh_token', 'is', null);

    // Add user filter if specified
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
      console.log(`[renew-garmin-token] Targeting specific user: ${targetUserId}`);
    } else {
      console.log('[renew-garmin-token] Processing all users with active tokens');
    }

    console.log('[renew-garmin-token] Executing database query...');
    const { data: tokens, error: queryError } = await query;

    if (queryError) {
      console.error('[renew-garmin-token] Error querying tokens:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to query tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[renew-garmin-token] Query completed. Found ${tokens?.length || 0} tokens`);
    
    if (tokens && tokens.length > 0) {
      console.log('[renew-garmin-token] Token details:');
      tokens.forEach((token, index) => {
        const expiresAt = token.expires_at ? new Date(token.expires_at) : 'N/A';
        const refreshExpiresAt = token.refresh_token_expires_at ? new Date(token.refresh_token_expires_at) : 'N/A';
        console.log(`[renew-garmin-token] ${index + 1}. User: ${token.user_id}, Garmin ID: ${token.garmin_user_id || 'N/A'}`);
        console.log(`[renew-garmin-token]     Expires: ${expiresAt}, Refresh expires: ${refreshExpiresAt}`);
      });
    }

    const results = [];
    if (!tokens || tokens.length === 0) {
      console.log('[renew-garmin-token] === NO TOKENS TO PROCESS - FUNCTION END ===');
      return new Response(JSON.stringify({
        success: true,
        message: targetUserId ? `No tokens found for user ${targetUserId}` : 'No tokens found to renew',
        results,
        summary: { total: 0, success: 0, failed: 0, skipped: 0 },
        timestamp: new Date().toISOString(),
        execution_time_ms: Date.now() - new Date(startTime).getTime()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[renew-garmin-token] Processing ${tokens.length} tokens...`);

    for (const token of tokens) {
      console.log(`[renew-garmin-token] Processing token for user: ${token.user_id}`);
      try {
        if (token.refresh_token_expires_at && new Date(token.refresh_token_expires_at) <= new Date()) {
          console.log(`[renew-garmin-token] Skipping user ${token.user_id} - refresh token expired`);
          results.push({
            user_id: token.user_id,
            status: 'skipped',
            message: 'Refresh token expired'
          });
          continue;
        }

        console.log(`[renew-garmin-token] Attempting to refresh token for user: ${token.user_id}`);

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

    console.log('[renew-garmin-token] Processing completed:');
    console.log(`[renew-garmin-token] - Total: ${summary.total}`);
    console.log(`[renew-garmin-token] - Success: ${summary.success}`);
    console.log(`[renew-garmin-token] - Failed: ${summary.failed}`);
    console.log(`[renew-garmin-token] - Skipped: ${summary.skipped}`);
    console.log(`[renew-garmin-token] === FUNCTION END - SUCCESS at ${new Date().toISOString()} ===`);

    return new Response(JSON.stringify({
      success: true,
      message: `Token renewal complete: ${summary.success} success, ${summary.failed} failed, ${summary.skipped} skipped`,
      results,
      summary,
      timestamp: new Date().toISOString(),
      execution_time_ms: Date.now() - new Date(startTime).getTime()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[renew-garmin-token] === FATAL ERROR ===');
    console.error('[renew-garmin-token] Error message:', error.message);
    console.error('[renew-garmin-token] Error stack:', error.stack);
    console.error(`[renew-garmin-token] === FUNCTION END - ERROR at ${new Date().toISOString()} ===`);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});