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
    const { accessToken, action = 'register', userId } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const webhookUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';

    if (action === 'list') {
      // Listar webhooks existentes
      console.log('[register-polar-webhook] Listando webhooks existentes...');
      
      const listResponse = await fetch('https://www.polaraccesslink.com/v3/webhooks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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

    // Registrar webhook
    console.log('[register-polar-webhook] Registrando webhook:', webhookUrl);
    
    const registerResponse = await fetch('https://www.polaraccesslink.com/v3/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

      // If we have a signature_secret_key in the response and userId, store it in polar_tokens
      if (resultData.data?.signature_secret_key && userId) {
        console.log('[register-polar-webhook] Storing signature secret key for user:', userId);
        
        try {
          const { error: updateError } = await supabase
            .from('polar_tokens')
            .update({ 
              signature_secret_key: resultData.data.signature_secret_key 
            })
            .eq('user_id', userId)
            .eq('is_active', true);

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
          signature_key_stored: !!(resultData.data?.signature_secret_key && userId)
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