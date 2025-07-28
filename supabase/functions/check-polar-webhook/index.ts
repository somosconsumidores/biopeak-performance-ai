import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get an active Polar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('polar_tokens')
      .select('access_token')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (tokenError || !tokenData) {
      console.log('[check-polar-webhook] Erro ao obter token:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Nenhum token Polar ativo encontrado' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const accessToken = tokenData.access_token;
    const expectedWebhookUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';

    console.log('[check-polar-webhook] Verificando webhooks registrados...');
    
    // List existing webhooks
    const listResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const listResult = await listResponse.text();
    console.log('[check-polar-webhook] Status da lista:', listResponse.status);
    console.log('[check-polar-webhook] Resposta da lista:', listResult);

    let webhooks = [];
    let isRegistered = false;

    if (listResponse.ok) {
      try {
        webhooks = JSON.parse(listResult);
        isRegistered = webhooks.some((webhook: any) => 
          webhook.url === expectedWebhookUrl || 
          webhook.notification_url === expectedWebhookUrl
        );
      } catch (e) {
        console.log('[check-polar-webhook] Erro ao parsear resposta:', e);
      }
    }

    // If not registered, try to register it
    if (!isRegistered) {
      console.log('[check-polar-webhook] Webhook não encontrado, tentando registrar...');
      
      const registerResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: expectedWebhookUrl
        })
      });

      const registerResult = await registerResponse.text();
      console.log('[check-polar-webhook] Status do registro:', registerResponse.status);
      console.log('[check-polar-webhook] Resultado do registro:', registerResult);

      return new Response(
        JSON.stringify({
          wasRegistered: false,
          registrationAttempted: true,
          registrationStatus: registerResponse.status,
          registrationResult: registerResult,
          webhookUrl: expectedWebhookUrl,
          existingWebhooks: webhooks
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({
        wasRegistered: true,
        webhookUrl: expectedWebhookUrl,
        existingWebhooks: webhooks,
        message: 'Webhook já está registrado na Polar!'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[check-polar-webhook] Erro:', error);
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