import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolarTokenRequest {
  code: string;
  redirect_uri?: string;
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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { code, redirect_uri }: PolarTokenRequest = await req.json();

    if (!code) {
      throw new Error('Authorization code is required');
    }

    // Get Polar API credentials
    const clientId = Deno.env.get('POLAR_CLIENT_ID');
    const clientSecret = Deno.env.get('POLAR_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Polar API credentials not configured');
    }

    // Prepare Basic Auth credentials
    const credentials = btoa(`${clientId}:${clientSecret}`);

    // Exchange authorization code for access token
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      ...(redirect_uri && { redirect_uri }),
    });

    console.log('Exchanging code for token with Polar API...');

    const tokenResponse = await fetch('https://polarremote.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json;charset=UTF-8',
      },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Polar token exchange error:', errorData);
      throw new Error(`Token exchange failed: ${errorData.error || tokenResponse.statusText}`);
    }

    const tokenData: PolarTokenResponse = await tokenResponse.json();
    console.log('Token exchange successful, x_user_id:', tokenData.x_user_id);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    // Store tokens in database
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
      console.error('Database insertion error:', insertError);
      throw new Error(`Failed to store tokens: ${insertError.message}`);
    }

    console.log('Polar tokens stored successfully for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Polar account connected successfully',
        x_user_id: tokenData.x_user_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Polar OAuth error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});