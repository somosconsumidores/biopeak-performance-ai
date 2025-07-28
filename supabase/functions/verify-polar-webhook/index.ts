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
    const token = 'aaa6f4948905ad1ad6c4847604ef368b';
    const expectedUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';
    
    console.log('[verify-polar-webhook] Verificando webhooks registrados...');
    
    // Listar webhooks existentes
    const listResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const listResult = await listResponse.text();
    console.log('[verify-polar-webhook] Status:', listResponse.status);
    console.log('[verify-polar-webhook] Webhooks existentes:', listResult);
    
    const isRegistered = listResult.includes(expectedUrl);
    
    if (!isRegistered) {
      console.log('[verify-polar-webhook] ❌ Webhook NÃO registrado! Registrando agora...');
      
      const registerResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: expectedUrl
        })
      });
      
      const registerResult = await registerResponse.text();
      console.log('[verify-polar-webhook] Registro - Status:', registerResponse.status);
      console.log('[verify-polar-webhook] Registro - Resultado:', registerResult);
      
      return new Response(
        JSON.stringify({
          wasRegistered: false,
          registrationAttempted: true,
          registrationStatus: registerResponse.status,
          registrationResult: registerResult,
          message: registerResponse.ok ? 'Webhook registrado com sucesso!' : 'Falha ao registrar webhook'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('[verify-polar-webhook] ✅ Webhook já está registrado!');
      
      return new Response(
        JSON.stringify({
          wasRegistered: true,
          message: 'Webhook já está registrado',
          webhooks: listResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('[verify-polar-webhook] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});