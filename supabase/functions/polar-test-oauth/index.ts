import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`🧪 Polar OAuth Test started at ${new Date().toISOString()}`);

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

    const { action, code, redirect_uri } = await req.json();

    console.log(`🧪 Test action: ${action}`);

    switch (action) {
      case 'test_callback_url':
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Callback URL is accessible',
            expected_callback: `${Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '')}/polar-callback`,
            current_origin: req.headers.get('origin'),
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );

      case 'manual_token_exchange':
        if (!code || !redirect_uri) {
          throw new Error('Code and redirect_uri are required for manual token exchange');
        }

        // Get Polar API credentials
        const clientId = Deno.env.get('POLAR_CLIENT_ID');
        const clientSecret = Deno.env.get('POLAR_CLIENT_SECRET');

        if (!clientId || !clientSecret) {
          throw new Error('Polar API credentials not configured');
        }

        // Exchange code for token manually
        const credentials = btoa(`${clientId}:${clientSecret}`);
        const tokenBody = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri,
        });

        console.log('🧪 Manual token exchange attempt...');
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
          const errorText = await tokenResponse.text();
          console.error('🧪 Manual token exchange failed:', errorText);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`,
              response_body: errorText,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }

        const tokenData = await tokenResponse.json();
        console.log('🧪 Manual token exchange successful:', tokenData);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Manual token exchange successful',
            token_data: {
              x_user_id: tokenData.x_user_id,
              token_type: tokenData.token_type,
              expires_in: tokenData.expires_in,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );

      case 'test_polar_endpoints':
        console.log('🧪 Testing Polar endpoint connectivity...');
        
        const tests = [];

        // Test authorization endpoint
        try {
          const authTest = await fetch('https://flow.polar.com/oauth2/authorization', { method: 'HEAD' });
          tests.push({
            endpoint: 'authorization',
            url: 'https://flow.polar.com/oauth2/authorization',
            status: authTest.status,
            accessible: authTest.status < 500,
          });
        } catch (error) {
          tests.push({
            endpoint: 'authorization',
            url: 'https://flow.polar.com/oauth2/authorization',
            status: 'error',
            accessible: false,
            error: error.message,
          });
        }

        // Test token endpoint
        try {
          const tokenTest = await fetch('https://polarremote.com/v2/oauth2/token', { method: 'HEAD' });
          tests.push({
            endpoint: 'token',
            url: 'https://polarremote.com/v2/oauth2/token',
            status: tokenTest.status,
            accessible: tokenTest.status < 500,
          });
        } catch (error) {
          tests.push({
            endpoint: 'token',
            url: 'https://polarremote.com/v2/oauth2/token',
            status: 'error',
            accessible: false,
            error: error.message,
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Polar endpoint connectivity test completed',
            tests,
            overall_status: tests.every(t => t.accessible) ? 'HEALTHY' : 'ISSUES_DETECTED',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );

      default:
        throw new Error(`Unknown test action: ${action}`);
    }

  } catch (error) {
    console.error('🧪 Polar OAuth test error:', error);
    
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