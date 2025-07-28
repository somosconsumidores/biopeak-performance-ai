import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[force-check-webhook] EXECUTANDO VERIFICAÇÃO FORÇADA DO WEBHOOK POLAR');

  try {
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get active token
    const { data: tokenData } = await supabase
      .from('polar_tokens')
      .select('access_token')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!tokenData) {
      console.log('[force-check-webhook] ❌ Nenhum token ativo encontrado');
      return new Response(JSON.stringify({ error: 'No active token' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const token = tokenData.access_token;
    const webhookUrl = 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook';
    
    console.log('[force-check-webhook] Token encontrado:', token.substring(0, 8) + '...');
    console.log('[force-check-webhook] Verificando webhook:', webhookUrl);

    // Check existing webhooks
    const listResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[force-check-webhook] Status da consulta:', listResponse.status);
    
    const listText = await listResponse.text();
    console.log('[force-check-webhook] Resposta completa:', listText);

    const isRegistered = listText.includes(webhookUrl);
    console.log('[force-check-webhook] Webhook está registrado?', isRegistered);

    if (!isRegistered) {
      console.log('[force-check-webhook] ❌ WEBHOOK NÃO REGISTRADO! Registrando agora...');
      
      const registerResponse = await fetch('https://www.polaraccesslink.com/v3/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: webhookUrl })
      });

      const registerText = await registerResponse.text();
      console.log('[force-check-webhook] Status do registro:', registerResponse.status);
      console.log('[force-check-webhook] Resultado do registro:', registerText);

      const success = registerResponse.ok;
      console.log('[force-check-webhook]', success ? '✅ WEBHOOK REGISTRADO COM SUCESSO!' : '❌ FALHA AO REGISTRAR WEBHOOK!');

      return new Response(JSON.stringify({
        status: success ? 'REGISTERED' : 'FAILED',
        message: success ? 'Webhook registrado com sucesso!' : 'Falha ao registrar webhook',
        registerStatus: registerResponse.status,
        registerResult: registerText
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else {
      console.log('[force-check-webhook] ✅ WEBHOOK JÁ ESTÁ REGISTRADO!');
      
      return new Response(JSON.stringify({
        status: 'ALREADY_REGISTERED',
        message: 'Webhook já está registrado',
        webhooks: listText
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error('[force-check-webhook] ERRO:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: 'ERROR'
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});