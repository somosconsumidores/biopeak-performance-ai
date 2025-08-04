import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🩺 Starting Polar API health check...');

    // Check Polar API credentials
    const clientId = Deno.env.get('POLAR_CLIENT_ID');
    const clientSecret = Deno.env.get('POLAR_CLIENT_SECRET');

    const healthStatus = {
      timestamp: new Date().toISOString(),
      credentials_configured: !!clientId && !!clientSecret,
      polar_api_accessible: false,
      authorization_endpoint_accessible: false,
      token_endpoint_accessible: false,
      errors: [] as string[],
    };

    if (!clientId || !clientSecret) {
      healthStatus.errors.push('Polar API credentials not configured');
      console.error('❌ Polar API credentials missing');
    } else {
      console.log('✅ Polar API credentials configured');
    }

    // Test Polar authorization endpoint
    console.log('🔍 Testing Polar authorization endpoint...');
    try {
      const authResponse = await fetch('https://flow.polar.com/oauth2/authorization', {
        method: 'HEAD',
      });
      
      if (authResponse.ok || authResponse.status === 405) {
        // 405 Method Not Allowed is expected for HEAD on authorization endpoint
        healthStatus.authorization_endpoint_accessible = true;
        console.log('✅ Polar authorization endpoint accessible');
      } else {
        healthStatus.errors.push(`Authorization endpoint returned ${authResponse.status}`);
        console.error(`❌ Authorization endpoint error: ${authResponse.status}`);
      }
    } catch (error) {
      healthStatus.errors.push(`Authorization endpoint error: ${error.message}`);
      console.error('❌ Authorization endpoint error:', error);
    }

    // Test Polar token endpoint (this will fail without proper auth, but we can test connectivity)
    console.log('🔍 Testing Polar token endpoint connectivity...');
    try {
      const tokenResponse = await fetch('https://polarremote.com/v2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=test', // Invalid but will test connectivity
      });
      
      // Any response (even error) means the endpoint is accessible
      healthStatus.token_endpoint_accessible = true;
      console.log('✅ Polar token endpoint accessible');
    } catch (error) {
      healthStatus.errors.push(`Token endpoint error: ${error.message}`);
      console.error('❌ Token endpoint error:', error);
    }

    // Overall API health
    healthStatus.polar_api_accessible = 
      healthStatus.authorization_endpoint_accessible && 
      healthStatus.token_endpoint_accessible;

    const overallHealth = healthStatus.credentials_configured && healthStatus.polar_api_accessible;

    console.log(`🩺 Health check completed. Overall status: ${overallHealth ? 'HEALTHY' : 'UNHEALTHY'}`);

    return new Response(
      JSON.stringify({
        healthy: overallHealth,
        status: healthStatus,
        recommendation: overallHealth 
          ? 'Polar integration is ready to use'
          : 'Please check configuration and network connectivity',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return new Response(
      JSON.stringify({
        healthy: false,
        error: error.message,
        recommendation: 'Health check system error - please contact support',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});