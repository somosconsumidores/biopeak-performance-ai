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

  try {
    const { action = 'register' } = await req.json();

    // Get Polar client credentials from environment
    const polarClientId = Deno.env.get('POLAR_CLIENT_ID');
    const polarClientSecret = Deno.env.get('POLAR_CLIENT_SECRET');
    
    if (!polarClientId || !polarClientSecret) {
      return new Response(
        JSON.stringify({ error: 'Polar client credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Basic Auth header
    const basicAuth = btoa(`${polarClientId}:${polarClientSecret}`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const webhookUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';
    const webhookEndpoint = 'https://www.polaraccesslink.com/v3/webhooks';

    if (action === 'list') {
      // Listar webhooks existentes
      console.log(`[register-polar-webhook] Listando webhooks existentes em: ${webhookEndpoint}`);
      
      const listResponse = await fetch(webhookEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      });

      const listResult = await listResponse.text();
      console.log('[register-polar-webhook] Lista de webhooks:', listResponse.status, listResult);

      return new Response(
        JSON.stringify({
          status: listResponse.status,
          message: 'Webhooks listados',
          data: listResult
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if webhook already exists to prevent conflicts
    console.log(`[register-polar-webhook] Verificando se webhook já existe em: ${webhookEndpoint}`);
    
    const checkResponse = await fetch(webhookEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });

    if (checkResponse.ok) {
      const existingWebhooks = await checkResponse.json();
      console.log('[register-polar-webhook] Webhooks existentes:', existingWebhooks);
      
      // Check if our webhook URL already exists
      const webhookExists = existingWebhooks.data?.some((webhook: any) => 
        webhook.url === webhookUrl
      );
      
      if (webhookExists) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Webhook já está registrado',
            webhookUrl,
            already_exists: true
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Registrar webhook
    console.log(`[register-polar-webhook] Registrando webhook em: ${webhookEndpoint}`);
    console.log(`[register-polar-webhook] URL do webhook: ${webhookUrl}`);
    
    const registerResponse = await fetch(webhookEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['EXERCISE']
      })
    });

    const registerResult = await registerResponse.text();
    console.log('[register-polar-webhook] Resultado do registro:', registerResponse.status, registerResult);

    if (registerResponse.ok) {
      let resultData;
      try {
        resultData = JSON.parse(registerResult);
      } catch {
        resultData = { data: registerResult };
      }

      // Store signature_secret_key globally in app_settings
      if (resultData.data?.signature_secret_key) {
        console.log('[register-polar-webhook] Storing signature secret key globally');
        
        try {
          const { error: updateError } = await supabase
            .from('app_settings')
            .update({ 
              setting_value: resultData.data.signature_secret_key,
              updated_at: new Date().toISOString()
            })
            .eq('setting_key', 'polar_webhook_signature_key');

          if (updateError) {
            console.error('[register-polar-webhook] Error storing signature key:', updateError);
          } else {
            console.log('[register-polar-webhook] Signature key stored successfully');
          }
        } catch (storeError) {
          console.error('[register-polar-webhook] Exception storing signature key:', storeError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook registrado com sucesso!',
          webhookUrl,
          status: registerResponse.status,
          data: resultData,
          signature_key_stored: !!resultData.data?.signature_secret_key
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: 'Falha ao registrar webhook',
          status: registerResponse.status,
          details: registerResult
        }),
        { 
          status: registerResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('[register-polar-webhook] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});