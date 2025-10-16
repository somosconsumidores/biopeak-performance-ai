import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, name, phone } = await req.json();

    if (!user_id) {
      console.error('❌ Missing user_id in request');
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📞 Notifying N8N for new user:', { user_id, name, phone: phone ? 'provided' : 'not provided' });

    // Get N8N webhook URL from app settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'n8n_webhook_url')
      .maybeSingle();

    if (settingsError) {
      console.error('❌ Error fetching N8N webhook URL:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch webhook configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings || !settings.setting_value) {
      console.warn('⚠️ N8N webhook URL not configured');
      return new Response(
        JSON.stringify({ message: 'N8N webhook not configured - skipping notification' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookUrl = settings.setting_value;

    // Send data to N8N
    const payload = {
      user_id,
      name: name || 'Não informado',
      phone: phone || 'Não informado',
      timestamp: new Date().toISOString(),
      source: 'BioPeak Onboarding',
    };

    console.log('📤 Sending to N8N:', { url: webhookUrl, payload });

    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('❌ N8N webhook failed:', { status: n8nResponse.status, error: errorText });
      return new Response(
        JSON.stringify({ error: 'Failed to notify N8N', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Successfully notified N8N');

    return new Response(
      JSON.stringify({ message: 'N8N notified successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in notify-n8n-new-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});