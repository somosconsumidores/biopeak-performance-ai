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
    // Get Polar client ID (safe to expose)
    const clientId = Deno.env.get('POLAR_CLIENT_ID');

    if (!clientId) {
      throw new Error('Polar client ID not configured');
    }

    return new Response(
      JSON.stringify({
        client_id: clientId,
        authorization_endpoint: 'https://flow.polar.com/oauth2/authorization',
        scope: 'accesslink.read_all',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Get Polar config error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});