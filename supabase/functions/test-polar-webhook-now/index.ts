import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usar o token mais recente que encontramos
    const token = '26e6002871353ecf9005ccb135e58b26';
    const expectedUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';
    
    console.log('[test-polar-webhook-now] Verificando AGORA se webhook está registrado...');
    console.log('[test-polar-webhook-now] Token usado:', token.substring(0, 8) + '...');
    console.log('[test-polar-webhook-now] URL esperada:', expectedUrl);
    
    // Listar webhooks existentes
    const listResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('[test-polar-webhook-now] Response status:', listResponse.status);
    
    const listResult = await listResponse.text();
    console.log('[test-polar-webhook-now] Response body:', listResult);
    
    let webhooks = [];
    let isRegistered = false;
    
    if (listResponse.ok) {
      try {
        webhooks = JSON.parse(listResult);
        console.log('[test-polar-webhook-now] Parsed webhooks:', JSON.stringify(webhooks, null, 2));
        
        isRegistered = webhooks.some((webhook: any) => 
          webhook.url === expectedUrl || 
          webhook.notification_url === expectedUrl ||
          JSON.stringify(webhook).includes(expectedUrl)
        );
        
        console.log('[test-polar-webhook-now] Webhook registrado?', isRegistered);
      } catch (e) {
        console.log('[test-polar-webhook-now] Erro ao parsear:', e);
        // Check if the URL is in the raw response
        isRegistered = listResult.includes(expectedUrl);
        console.log('[test-polar-webhook-now] Check manual na string:', isRegistered);
      }
    }
    
    if (!isRegistered) {
      console.log('[test-polar-webhook-now] ❌ WEBHOOK NÃO REGISTRADO! Tentando registrar...');
      
      const registerResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: expectedUrl
        })
      });
      
      const registerResult = await registerResponse.text();
      console.log('[test-polar-webhook-now] Registro status:', registerResponse.status);
      console.log('[test-polar-webhook-now] Registro result:', registerResult);
      
      return new Response(
        JSON.stringify({
          status: 'WEBHOOK_REGISTRADO',
          wasRegistered: false,
          registrationStatus: registerResponse.status,
          registrationSuccess: registerResponse.ok,
          message: registerResponse.ok ? '✅ Webhook registrado com sucesso!' : '❌ Falha ao registrar webhook',
          details: registerResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('[test-polar-webhook-now] ✅ WEBHOOK JÁ ESTÁ REGISTRADO!');
      
      return new Response(
        JSON.stringify({
          status: 'WEBHOOK_OK',
          wasRegistered: true,
          message: '✅ Webhook já está registrado',
          webhooks: webhooks
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('[test-polar-webhook-now] ERRO:', error);
    return new Response(
      JSON.stringify({ 
        status: 'ERROR',
        error: error.message,
        message: '❌ Erro ao verificar webhook'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});