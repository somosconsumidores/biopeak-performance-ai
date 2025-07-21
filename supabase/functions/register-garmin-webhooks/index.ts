import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('[register-garmin-webhooks] ===== FUNCTION STARTED =====');
  console.log('[register-garmin-webhooks] Method:', req.method);
  console.log('[register-garmin-webhooks] URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[register-garmin-webhooks] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment variables check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('GARMIN_CLIENT_ID');
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');

    console.log('[register-garmin-webhooks] Environment variables check:', {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      clientId: !!clientId,
      clientSecret: !!clientSecret
    });

    if (!supabaseUrl || !supabaseKey || !clientId || !clientSecret) {
      throw new Error('Missing required environment variables');
    }

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[register-garmin-webhooks] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('[register-garmin-webhooks] User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[register-garmin-webhooks] User authenticated:', user.id);

    // Get user's Garmin token
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData?.access_token) {
      console.error('[register-garmin-webhooks] No valid Garmin token found:', tokenError);
      return new Response(
        JSON.stringify({ error: 'No valid Garmin token found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Webhook endpoint URL
    const webhookUrl = `${supabaseUrl}/functions/v1/garmin-activities-webhook`;
    console.log('[register-garmin-webhooks] Registering webhook URL:', webhookUrl);

    // Register webhook with Garmin
    const webhookPayload = {
      webhookUrl: webhookUrl,
      webhookType: 'push'
    };

    console.log('[register-garmin-webhooks] Webhook payload:', webhookPayload);

    const garminResponse = await fetch('https://connectapi.garmin.com/di-activity-service/activities/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('[register-garmin-webhooks] Garmin response status:', garminResponse.status);
    const responseText = await garminResponse.text();
    console.log('[register-garmin-webhooks] Garmin response body:', responseText);

    if (!garminResponse.ok) {
      console.error('[register-garmin-webhooks] Failed to register webhook');
      return new Response(
        JSON.stringify({ 
          error: 'Failed to register webhook with Garmin',
          details: responseText,
          status: garminResponse.status
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[register-garmin-webhooks] Webhook registered successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook registered successfully',
        webhookUrl: webhookUrl
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[register-garmin-webhooks] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});