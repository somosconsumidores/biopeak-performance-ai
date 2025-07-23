import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[register-garmin-webhooks] Starting webhook registration...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Not authenticated');
    }

    console.log(`[register-garmin-webhooks] Registering webhooks for user: ${user.id}`);

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('garmin_tokens')
      .select('access_token, garmin_user_id')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error(`No Garmin tokens found: ${tokenError?.message}`);
    }

    if (!tokenData.access_token) {
      throw new Error('No access token available');
    }

    console.log(`[register-garmin-webhooks] Found tokens for Garmin user: ${tokenData.garmin_user_id}`);

    // Register webhook with Garmin
    const webhookUrl = `https://${Deno.env.get('SUPABASE_URL')?.replace('https://', '')}/functions/v1/garmin-activities-webhook`;
    
    console.log(`[register-garmin-webhooks] Registering webhook URL: ${webhookUrl}`);

    const registerResponse = await fetch(`https://apis.garmin.com/wellness-api/rest/user/id/${tokenData.garmin_user_id}/registration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhookUrl: webhookUrl
      })
    });

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error(`[register-garmin-webhooks] Webhook registration failed:`, errorText);
      throw new Error(`Webhook registration failed: ${registerResponse.status} - ${errorText}`);
    }

    const result = await registerResponse.json();
    console.log(`[register-garmin-webhooks] Webhook registration successful:`, result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhooks registered successfully',
        result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[register-garmin-webhooks] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});