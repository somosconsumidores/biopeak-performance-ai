import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { handleError } from '../_shared/error-handler.ts';

const GARMIN_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";

interface TokenRequest {
  grant_type: string;
  client_id: string;
  client_secret: string;
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  refresh_token?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  jti: string;
  refresh_token_expires_in: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('[garmin-oauth] ===== FUNCTION STARTED =====');
  console.log('[garmin-oauth] Method:', req.method);
  console.log('[garmin-oauth] URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[garmin-oauth] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  return await handleError('garmin-oauth', async () => {
    console.log('[garmin-oauth] Entering try block...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('GARMIN_CLIENT_ID');
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');

    console.log('[garmin-oauth] Environment variables check:', {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      clientId: !!clientId,
      clientSecret: !!clientSecret
    });

    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}`);
    }

    if (!clientId || !clientSecret) {
      const missing = [];
      if (!clientId) missing.push('GARMIN_CLIENT_ID');
      if (!clientSecret) missing.push('GARMIN_CLIENT_SECRET');
      console.error('[garmin-oauth] Missing Garmin credentials:', missing);
      throw new Error(`Credenciais do Garmin não configuradas: ${missing.join(', ')}. Configure no painel do Supabase.`);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle GET request to return client ID
    if (req.method === "GET") {
      const cleanClientId = clientId.replace(/^\+/, "");
      return new Response(JSON.stringify({ client_id: cleanClientId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle POST request for token exchange
    if (req.method === "POST") {
      // Get the authorization header
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        console.error('[garmin-oauth] No authorization header found');
        throw new Error('No authorization header');
      }

      // Verify the JWT token
      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (authError || !user) {
        console.error('[garmin-oauth] Authentication error:', authError);
        throw new Error('Invalid token');
      }

      console.log('[garmin-oauth] User authenticated:', user.id);

      let body;
      try {
        const rawText = await req.text();
        console.log('[garmin-oauth] Raw request body:', rawText);
        
        if (!rawText || rawText.trim() === '') {
          console.error('[garmin-oauth] Empty request body received');
          throw new Error('Request body is empty');
        }
        
        body = JSON.parse(rawText);
        console.log('[garmin-oauth] Parsed request body:', body);
      } catch (error) {
        console.error('[garmin-oauth] Failed to parse request body:', error);
        throw new Error('Invalid request body - must be valid JSON');
      }

      const { code, codeVerifier, redirectUri, refresh_token, grant_type } = body;

      console.log('[garmin-oauth] Received parameters:', {
        code: !!code,
        codeVerifier: !!codeVerifier,
        redirectUri: !!redirectUri,
        refresh_token: !!refresh_token,
        grant_type: grant_type
      });

      // Handle refresh token flow
      if (grant_type === 'refresh_token') {
        if (!refresh_token) {
          throw new Error('Missing refresh_token for refresh flow');
        }

        // Handle the refresh token - it's passed directly now
        let refreshTokenValue = refresh_token;
        
        // If it's base64 encoded (legacy format), decode it
        if (refresh_token && refresh_token.length > 100) {
          try {
            const decodedSecret = atob(refresh_token);
            const secretData = JSON.parse(decodedSecret);
            refreshTokenValue = secretData.refreshTokenValue;
          } catch (error) {
            // If decoding fails, assume it's already the raw token
            console.log('[garmin-oauth] Using refresh token as-is (not base64 encoded)');
          }
        }

        const cleanClientId = clientId.replace(/^\+/, "");
        const refreshRequestData: TokenRequest = {
          grant_type: "refresh_token",
          client_id: cleanClientId,
          client_secret: clientSecret,
          refresh_token: refreshTokenValue,
        };

        const formData = new URLSearchParams();
        Object.entries(refreshRequestData).forEach(([key, value]) => {
          if (value) formData.append(key, value);
        });

        console.log('[garmin-oauth] Refreshing tokens...');
        const response = await fetch(GARMIN_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[garmin-oauth] Token refresh failed:', errorText);
          throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
        }

        const tokenData = await response.json();
        console.log('[garmin-oauth] New tokens received');

        // Update tokens in database with proper refresh token handling
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
        const refreshTokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days
        const newTokenSecret = btoa(JSON.stringify({
          refreshTokenValue: tokenData.refresh_token || refreshTokenValue,
          garminGuid: refresh_token && refresh_token.length > 100 ? 
            JSON.parse(atob(refresh_token)).garminGuid : 
            'unknown'
        }));

        const { error: updateError } = await supabase
          .from('garmin_tokens')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || refreshTokenValue,
            token_secret: newTokenSecret,
            expires_at: expiresAt,
            refresh_token_expires_at: refreshTokenExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('[garmin-oauth] Error updating tokens:', updateError);
          throw updateError;
        }

        return new Response(JSON.stringify({
          success: true,
          access_token: tokenData.access_token,
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
          refresh_token: tokenData.refresh_token,
          scope: tokenData.scope
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle authorization code flow
      if (!code || !codeVerifier || !redirectUri) {
        throw new Error('Missing required fields: code, codeVerifier, redirectUri');
      }

      // Check if this code has already been used by looking for existing tokens
      const { data: existingTokens } = await supabase
        .from('garmin_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingTokens) {
        const expiresAt = new Date(existingTokens.expires_at || 0).getTime();
        const isExpired = Date.now() >= expiresAt;
        
        if (!isExpired) {
          // User already has valid tokens, don't proceed with new authorization
          console.log('[garmin-oauth] User already has valid tokens, rejecting new authorization');
          throw new Error('User already connected to Garmin. Please disconnect first or use token refresh.');
        } else {
          // Delete expired tokens before proceeding
          await supabase
            .from('garmin_tokens')
            .delete()
            .eq('user_id', user.id);
        }
      }

      // Store PKCE data in database for verification
      const { error: pkceError } = await supabase
        .from('oauth_temp_tokens')
        .insert({
          provider: 'garmin',
          oauth_token: codeVerifier,
          user_id: user.id,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
        });

      if (pkceError) {
        console.error('[garmin-oauth] Error storing PKCE data:', pkceError);
      }

      const cleanClientId = clientId.replace(/^\+/, "");
      const tokenRequestData: TokenRequest = {
        grant_type: "authorization_code",
        client_id: cleanClientId,
        client_secret: clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      };

      const formData = new URLSearchParams();
      Object.entries(tokenRequestData).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      console.log('[garmin-oauth] Exchanging code for tokens...');
      console.log('[garmin-oauth] Request URL:', GARMIN_TOKEN_URL);
      console.log('[garmin-oauth] Request body:', formData.toString());

      const response = await fetch(GARMIN_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: formData.toString(),
      });

      console.log('[garmin-oauth] Token response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[garmin-oauth] Token exchange failed:', errorText);
        
        // Clean up any partial state on failure
        await supabase
          .from('oauth_temp_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('provider', 'garmin');
        
        // Provide more specific error messages
        if (response.status === 400) {
          if (errorText.includes('invalid_request') || errorText.includes('Invalid authorization code')) {
            throw new Error(`Código de autorização inválido ou expirado. Isso pode acontecer se você tentar conectar mais de uma vez ou se demorar muito tempo. Por favor, tente novamente: ${response.status}`);
          } else if (errorText.includes('invalid_client')) {
            throw new Error('Configuração do cliente OAuth inválida. Verifique as credenciais do Garmin.');
          } else if (errorText.includes('invalid_grant')) {
            throw new Error('Autorização inválida. Por favor, tente conectar novamente.');
          }
        }
        
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('[garmin-oauth] Token data received:', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      });

      // Fetch Garmin User API ID for webhook association
      console.log('[garmin-oauth] Fetching Garmin User API ID...');
      let garminUserId = null;
      let initialPermissions = [];
      
      try {
        const userIdResponse = await fetch('https://apis.garmin.com/wellness-api/rest/user/id', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (userIdResponse.ok) {
          const userIdData = await userIdResponse.json();
          garminUserId = userIdData.userId;
          console.log('[garmin-oauth] Garmin User API ID retrieved:', garminUserId);

          // Fetch initial user permissions
          console.log('[garmin-oauth] Fetching initial user permissions...');
          const permissionsResponse = await fetch('https://apis.garmin.com/wellness-api/rest/user/permissions', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json'
            }
          });

          if (permissionsResponse.ok) {
            const permissionsData = await permissionsResponse.json();
            initialPermissions = permissionsData.permissions || [];
            console.log('[garmin-oauth] Initial permissions retrieved:', initialPermissions);
          } else {
            console.warn('[garmin-oauth] Failed to fetch initial permissions:', permissionsResponse.status);
          }
        } else {
          console.warn('[garmin-oauth] Failed to fetch Garmin User ID:', userIdResponse.status);
        }
      } catch (error) {
        console.warn('[garmin-oauth] Error fetching Garmin User ID or permissions:', error);
      }

      // Store tokens in database
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      
      // Check if this is a new user connection
      const { data: existingToken } = await supabase
        .from('garmin_tokens')
        .select('initial_sync_completed')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const isFirstConnection = !existingToken;
      
      // Create the token secret in the same format expected by refresh flow
      const tokenSecret = btoa(JSON.stringify({
        refreshTokenValue: tokenData.refresh_token,
        garminGuid: garminUserId
      }));

      // Set refresh token expiration to 90 days
      const refreshTokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase
        .from('garmin_tokens')
        .upsert({
          user_id: user.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_secret: tokenSecret,
          consumer_key: cleanClientId,
          garmin_user_id: garminUserId,
          expires_at: expiresAt,
          refresh_token_expires_at: refreshTokenExpiresAt,
          initial_sync_completed: false, // Always false for new connections
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (insertError) {
        console.error('[garmin-oauth] Error storing tokens:', insertError);
        throw insertError;
      }

      // Store initial permissions if we have them
      if (garminUserId && initialPermissions.length > 0) {
        console.log('[garmin-oauth] Storing initial permissions...');
        const { error: permissionsError } = await supabase
          .from('garmin_user_permissions')
          .upsert({
            user_id: user.id,
            garmin_user_id: garminUserId,
            permissions: initialPermissions,
            granted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,garmin_user_id'
          });

        if (permissionsError) {
          console.error('[garmin-oauth] Error storing initial permissions:', permissionsError);
          // Don't throw here, just log the error
        } else {
          console.log('[garmin-oauth] Initial permissions stored successfully');
        }
      }

      // Clean up temp PKCE data
      await supabase
        .from('oauth_temp_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'garmin');

      console.log('[garmin-oauth] OAuth flow completed successfully');

      return new Response(JSON.stringify({
        success: true,
        message: 'Garmin Connect connected successfully',
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  }, {
    requestData: { method: req.method, url: req.url }
  });
});
