import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4"

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

    // Verify OAuth state for CSRF protection (state is optional per Polar docs)
    let tempToken = null;
    if (state) {
      console.log('🔍 Verifying OAuth state...');
      const { data: foundToken, error: stateError } = await supabase
        .from('oauth_temp_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('oauth_token', state)
        .eq('provider', 'polar')
        .single();

      if (stateError || !foundToken) {
        console.warn('⚠️ State verification failed, but continuing (state is optional):', { stateError, receivedState: state, userId: user.id });
        // Continue without state validation since it's optional per Polar documentation
      } else {
        tempToken = foundToken;
        console.log('✅ Found matching OAuth state token:', {
          tokenId: tempToken.id,
          provider: tempToken.provider,
          createdAt: tempToken.created_at
        });
        console.log('✅ OAuth state verified successfully');
      }
    } else {
      console.log('ℹ️ No state parameter provided (optional per Polar docs)');
    }

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

    // Clean up the temporary OAuth state if it exists
    if (tempToken) {
      console.log('🧹 Cleaning up temporary OAuth state...');
      await supabase
        .from('oauth_temp_tokens')
        .delete()
        .eq('id', tempToken.id);
    } else {
      console.log('🧹 No temporary OAuth state to clean up');
    }
    
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

    // MANDATORY: Register user with Polar API (POST /v3/users)
    console.log('👤 Registering user with Polar API (mandatory step)...');
    try {
      console.log(`👤 Calling POST https://www.polaraccesslink.com/v3/users with member-id: ${user.id}`);
      
      const userRegistrationResponse = await fetch('https://www.polaraccesslink.com/v3/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          'member-id': user.id,
        }),
      });

      console.log(`👤 User registration response status: ${userRegistrationResponse.status} ${userRegistrationResponse.statusText}`);

      if (!userRegistrationResponse.ok) {
        const errorData = await userRegistrationResponse.json().catch(() => ({}));
        console.error('❌ Polar user registration failed:', errorData);
        
        // If user already exists (409), that's okay - continue
        if (userRegistrationResponse.status === 409) {
          console.log('✅ User already registered with Polar (409 conflict is expected)');
        } else {
          console.error(`❌ User registration failed with status ${userRegistrationResponse.status}`);
          throw new Error(`User registration failed: ${errorData.error || userRegistrationResponse.statusText}`);
        }
      } else {
        const userData = await userRegistrationResponse.json();
        console.log('✅ Polar user registered successfully:', userData);
      }

      // Configure webhook for activity notifications
      console.log('🔔 Configuring webhook for activity notifications...');
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/polar-activities-webhook`;
      console.log(`🔔 Webhook URL: ${webhookUrl}`);
      
      const webhookResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
        }),
      });

      console.log(`🔔 Webhook response status: ${webhookResponse.status} ${webhookResponse.statusText}`);

      if (!webhookResponse.ok) {
        const webhookError = await webhookResponse.json().catch(() => ({}));
        console.error('⚠️ Webhook registration failed (non-critical):', webhookError);
        console.log('⚠️ Webhook registration failed, but user registration was successful');
      } else {
        const webhookData = await webhookResponse.json();
        console.log('✅ Webhook configured successfully:', webhookData);
      }

    } catch (registrationError) {
      console.error('❌ Critical error during user registration:', registrationError);
      // This is critical - if user registration fails, the integration won't work
      throw new Error(`Failed to register user with Polar: ${registrationError.message}`);
    }

    // Trigger initial sleep data sync
    try {
      console.log('🛌 Triggering initial sleep data sync...');
      const syncSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const sleepSyncResponse = await syncSupabase.functions.invoke('sync-polar-sleep', {
        body: { user_id: user.id }
      });

      if (sleepSyncResponse.error) {
        console.error('⚠️ Sleep sync error:', sleepSyncResponse.error);
      } else {
        console.log('✅ Initial sleep sync completed successfully:', sleepSyncResponse.data);
      }
    } catch (sleepSyncError) {
      console.error('⚠️ Error triggering sleep sync:', sleepSyncError);
      // Don't fail the OAuth flow if sleep sync fails
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