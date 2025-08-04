import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolarTokenRequest {
  code: string;
  redirect_uri?: string;
  state?: string;
}

interface PolarTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  x_user_id: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`🚀 Polar OAuth request started at ${new Date().toISOString()}`);

  try {
    // Log request details
    console.log(`📨 Request method: ${req.method}`);
    console.log(`📨 Request URL: ${req.url}`);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      throw new Error('No authorization header');
    }
    console.log('✅ Authorization header present');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the current user
    console.log('🔍 Getting current user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ User authentication failed:', userError);
      throw new Error('User not authenticated');
    }
    console.log(`✅ User authenticated: ${user.id}`);

    // Parse request body
    console.log('📝 Parsing request body...');
    const { code, redirect_uri, state }: PolarTokenRequest = await req.json();
    console.log(`📝 Authorization code received: ${code ? 'YES' : 'NO'}`);
    console.log(`📝 Redirect URI: ${redirect_uri || 'not provided'}`);
    console.log(`📝 State: ${state || 'not provided'}`);

    if (!code) {
      console.error('❌ No authorization code provided');
      throw new Error('Authorization code is required');
    }

    if (!redirect_uri) {
      console.error('❌ No redirect URI provided');
      throw new Error('Redirect URI is required');
    }

    if (!state) {
      console.error('❌ No state parameter provided');
      throw new Error('State parameter is required for CSRF protection');
    }

    // Get Polar API credentials
    console.log('🔑 Checking Polar API credentials...');
    const clientId = Deno.env.get('POLAR_CLIENT_ID');
    const clientSecret = Deno.env.get('POLAR_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ Polar API credentials not configured');
      console.error(`Client ID present: ${!!clientId}, Client Secret present: ${!!clientSecret}`);
      throw new Error('Polar API credentials not configured');
    }
    console.log('✅ Polar API credentials configured');

    // Verify OAuth state for CSRF protection
    console.log('🔍 Verifying OAuth state...');
    const { data: tempToken, error: stateError } = await supabase
      .from('oauth_temp_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('oauth_token', state)
      .eq('provider', 'polar')
      .single();

    if (stateError || !tempToken) {
      console.error('❌ Invalid or expired OAuth state:', { stateError, receivedState: state, userId: user.id });
      throw new Error('Invalid or expired OAuth state. Please restart the authentication process.');
    }

    // Log the found token for debugging
    console.log('✅ Found matching OAuth state token:', {
      tokenId: tempToken.id,
      provider: tempToken.provider,
      createdAt: tempToken.created_at
    });

    console.log('✅ OAuth state verified successfully');

    // Prepare Basic Auth credentials
    const credentials = btoa(`${clientId}:${clientSecret}`);

    // Exchange authorization code for access token
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect_uri, // Must be included and identical to authorization request
    });

    console.log('🔄 Exchanging authorization code for access token...');
    console.log(`🔄 Token endpoint: https://polarremote.com/v2/oauth2/token`);
    console.log(`🔄 Grant type: authorization_code`);
    console.log(`🔄 Redirect URI: ${redirect_uri}`);

    const tokenResponse = await fetch('https://polarremote.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json;charset=UTF-8',
      },
      body: tokenBody.toString(),
    });

    console.log(`📡 Polar API response status: ${tokenResponse.status} ${tokenResponse.statusText}`);
    console.log(`📡 Polar API response headers:`, Object.fromEntries(tokenResponse.headers.entries()));

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Polar token exchange failed');
      console.error(`❌ Status: ${tokenResponse.status} ${tokenResponse.statusText}`);
      console.error(`❌ Response body: ${errorText}`);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: 'parse_error', description: errorText };
      }
      
      // Map Polar error codes to user-friendly messages
      const errorMessages = {
        'invalid_request': 'The request is missing required parameters or is malformed',
        'invalid_client': 'Client authentication failed. Please check your Polar app configuration.',
        'invalid_grant': 'The authorization code is invalid, expired, or has already been used',
        'unauthorized_client': 'The client is not authorized to use this authorization grant type',
        'unsupported_grant_type': 'The authorization grant type is not supported',
        'invalid_scope': 'The requested scope is invalid or malformed'
      };

      const userMessage = errorMessages[errorData.error] || 'Failed to exchange authorization code for access token';
      
      throw new Error(`${userMessage} (${errorData.error || tokenResponse.statusText})`);
    }

    const tokenData: PolarTokenResponse = await tokenResponse.json();
    console.log('✅ Token exchange successful!');
    console.log(`✅ X-User-ID: ${tokenData.x_user_id}`);
    console.log(`✅ Token type: ${tokenData.token_type}`);
    console.log(`✅ Expires in: ${tokenData.expires_in} seconds`);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    console.log(`📅 Token expires at: ${expiresAt.toISOString()}`);

    // Store tokens in database
    console.log('💾 Storing tokens in database...');
    console.log(`💾 User ID: ${user.id}`);
    console.log(`💾 Polar User ID: ${tokenData.x_user_id}`);

    // Clean up the temporary OAuth state
    console.log('🧹 Cleaning up temporary OAuth state...');
    await supabase
      .from('oauth_temp_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('oauth_token', state)
      .eq('provider', 'polar');
    
    const { error: insertError } = await supabase
      .from('polar_tokens')
      .insert({
        user_id: user.id,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: expiresAt.toISOString(),
        x_user_id: tokenData.x_user_id,
        polar_user_id: tokenData.x_user_id.toString(),
        is_active: true,
      });

    if (insertError) {
      console.error('❌ Database insertion failed:', insertError);
      console.error('❌ Error code:', insertError.code);
      console.error('❌ Error details:', insertError.details);
      console.error('❌ Error hint:', insertError.hint);
      throw new Error(`Failed to store tokens: ${insertError.message}`);
    }

    console.log('✅ Polar tokens stored successfully in database');

    // Register user with Polar and configure webhooks
    console.log('🔗 Registering user with Polar and configuring webhooks...');
    try {
      const registerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/register-polar-user`;
      console.log(`🔗 Registration URL: ${registerUrl}`);
      
      const registerResponse = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: tokenData.access_token,
        }),
      });

      console.log(`🔗 Registration response status: ${registerResponse.status} ${registerResponse.statusText}`);

      if (!registerResponse.ok) {
        const registerErrorText = await registerResponse.text();
        console.error('⚠️ Failed to register Polar user, but tokens were saved');
        console.error(`⚠️ Registration error response: ${registerErrorText}`);
      } else {
        const registerData = await registerResponse.json();
        console.log('✅ Polar user registered and webhook configured successfully');
        console.log('✅ Registration response:', registerData);
      }
    } catch (registrationError) {
      console.error('⚠️ Registration error (non-fatal):', registrationError);
      // Don't fail the whole process if registration fails
    }

    const duration = Date.now() - startTime;
    console.log(`🏁 Polar OAuth process completed successfully in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Polar account connected successfully',
        x_user_id: tokenData.x_user_id,
        duration_ms: duration,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Polar OAuth process failed after ${duration}ms`);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
        duration_ms: duration,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});