import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GARMIN_TOKEN_URL = "https://connectapi.garmin.com/di-oauth2-service/oauth/token";

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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Garmin OAuth function called with method:', req.method);
    const garminClientId = Deno.env.get('GARMIN_CLIENT_ID');
    const garminClientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');
    
    console.log('Client ID exists:', !!garminClientId);
    console.log('Client Secret exists:', !!garminClientSecret);

    if (!garminClientId || !garminClientSecret) {
      console.error('Missing Garmin credentials - Client ID:', !!garminClientId, 'Client Secret:', !!garminClientSecret);
      throw new Error('Garmin OAuth credentials not configured');
    }

    // Handle GET request to return client ID (public info)
    if (req.method === 'GET') {
      console.log('Handling GET request - returning client ID');
      // Remove any leading '+' from client ID
      const cleanClientId = garminClientId?.replace(/^\+/, '') || '';
      return new Response(JSON.stringify({ client_id: cleanClientId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only POST requests should have JSON body
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse JSON body for POST requests with error handling
    let requestBody: any;
    try {
      const bodyText = await req.text();
      console.log('Request body text:', bodyText);
      requestBody = bodyText ? JSON.parse(bodyText) : {};
    } catch (e) {
      console.error('Invalid JSON body:', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Parsed request body:', requestBody);
    const { action, ...requestData } = requestBody;

    let tokenRequestData: TokenRequest;

    if (action === 'exchange_code') {
      // Exchange authorization code for tokens
      const { code, codeVerifier, redirectUri } = requestData;
      
      tokenRequestData = {
        grant_type: 'authorization_code',
        client_id: garminClientId,
        client_secret: garminClientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      };
    } else if (action === 'refresh_token') {
      // Refresh access token
      const { refreshToken } = requestData;
      
      tokenRequestData = {
        grant_type: 'refresh_token',
        client_id: garminClientId,
        client_secret: garminClientSecret,
        refresh_token: refreshToken,
      };
    } else {
      throw new Error('Invalid action');
    }

    // Make request to Garmin token endpoint
    const formData = new URLSearchParams();
    Object.entries(tokenRequestData).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    const response = await fetch(GARMIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Garmin API error:', errorText);
      throw new Error(`Garmin API error: ${response.status} - ${errorText}`);
    }

    const tokenResponse: TokenResponse = await response.json();

    return new Response(JSON.stringify(tokenResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});