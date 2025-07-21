
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('[register-garmin-webhooks] Function started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header and extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[register-garmin-webhooks] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log(`[register-garmin-webhooks] Registering webhooks for user: ${user.id}`);

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      console.error('[register-garmin-webhooks] Token error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Garmin tokens not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Register webhooks with Garmin API
    const webhookBaseUrl = `${supabaseUrl}/functions/v1`;
    
    const webhooksToRegister = [
      {
        type: 'activity',
        url: `${webhookBaseUrl}/garmin-activities-webhook`,
        description: 'Activity sync webhook'
      }
    ];

    const registrationResults = [];

    for (const webhook of webhooksToRegister) {
      try {
        console.log(`[register-garmin-webhooks] Registering ${webhook.type} webhook`);
        
        const garminResponse = await fetch('https://connectapi.garmin.com/webhook-service-1.0/webhooks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            callbackUrl: webhook.url,
            events: ['activity']
          })
        });

        if (garminResponse.ok) {
          const webhookData = await garminResponse.json();
          console.log(`[register-garmin-webhooks] Successfully registered ${webhook.type} webhook:`, webhookData);
          
          // Store webhook registration in database
          await supabase
            .from('garmin_webhook_logs')
            .insert({
              user_id: user.id,
              webhook_type: webhook.type,
              callback_url: webhook.url,
              status: 'registered',
              garmin_response: webhookData
            });

          registrationResults.push({
            type: webhook.type,
            status: 'success',
            data: webhookData
          });
        } else {
          const errorText = await garminResponse.text();
          console.error(`[register-garmin-webhooks] Failed to register ${webhook.type} webhook:`, errorText);
          
          registrationResults.push({
            type: webhook.type,
            status: 'error',
            error: errorText
          });
        }
      } catch (error) {
        console.error(`[register-garmin-webhooks] Error registering ${webhook.type} webhook:`, error);
        
        registrationResults.push({
          type: webhook.type,
          status: 'error',
          error: error.message
        });
      }
    }

    const successCount = registrationResults.filter(r => r.status === 'success').length;
    const totalCount = registrationResults.length;

    console.log(`[register-garmin-webhooks] Registration completed: ${successCount}/${totalCount} webhooks registered`);

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `${successCount}/${totalCount} webhooks registered successfully`,
        results: registrationResults
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
