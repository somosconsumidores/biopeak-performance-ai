import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const GARMIN_TOKEN_URL = "https://connect.garmin.com/oauth2/token";

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

  try {
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
        body = await req.json();
      } catch (error) {
        console.error('Failed to parse request body:', error);
        throw new Error('Invalid request body - must be valid JSON');
      }

      const { code, codeVerifier, redirectUri } = body;

      console.log('[garmin-oauth] Received OAuth parameters:', {
        code: !!code,
        codeVerifier: !!codeVerifier,
        redirectUri: !!redirectUri
      });

      if (!code || !codeVerifier || !redirectUri) {
        throw new Error('Missing required fields: code, codeVerifier, redirectUri');
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
      const tokenRequestData: Omit<TokenRequest, 'client_id' | 'client_secret'> = {
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      };

      const formData = new URLSearchParams();
      Object.entries(tokenRequestData).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      console.log('[garmin-oauth] Exchanging code for tokens...');
      console.log('[garmin-oauth] Request body:', formData.toString());
      console.log('[garmin-oauth] Request headers:', {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${cleanClientId}:${clientSecret}`)}`,
        "Accept": "application/json"
      });

      const response = await fetch(GARMIN_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${cleanClientId}:${clientSecret}`)}`,
          "Accept": "application/json"
        },
        body: formData.toString(),
      });

      console.log('[garmin-oauth] Token response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[garmin-oauth] Token exchange failed:', errorText);
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('[garmin-oauth] Token data received:', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      });

      // Store tokens in database
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      const { error: insertError } = await supabase
        .from('garmin_tokens')
        .upsert({
          user_id: user.id,
          access_token: tokenData.access_token,
          token_secret: tokenData.refresh_token || '',
          consumer_key: cleanClientId,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (insertError) {
        console.error('[garmin-oauth] Error storing tokens:', insertError);
        throw insertError;
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

  } catch (error) {
    console.error('[garmin-oauth] Error in OAuth flow:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});