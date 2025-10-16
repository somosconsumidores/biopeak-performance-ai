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

    // Processar fila de notificações pendentes
    const { data: pendingNotifications, error: queueError } = await supabaseClient
      .from('n8n_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('❌ Error fetching queue:', queueError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notification queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('ℹ️ No pending notifications in queue');
      return new Response(
        JSON.stringify({ message: 'No pending notifications' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Processing ${pendingNotifications.length} pending notifications`);
    
    const results = [];
    
    for (const notification of pendingNotifications) {
      const { id, user_id, name, phone } = notification;

      if (!user_id) {
        console.error('❌ Missing user_id in notification:', id);
        await supabaseClient
          .from('n8n_notification_queue')
          .update({ 
            status: 'error',
            error_message: 'Missing user_id',
            processed_at: new Date().toISOString()
          })
          .eq('id', id);
        continue;
      }

      console.log(`📞 Processing notification ${id} for user:`, { user_id, name, phone: phone ? 'provided' : 'not provided' });

      // Get N8N webhook URL from app settings
      const { data: settings, error: settingsError } = await supabaseClient
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'n8n_webhook_url')
        .maybeSingle();

      if (settingsError) {
        console.error('❌ Error fetching N8N webhook URL:', settingsError);
        await supabaseClient
          .from('n8n_notification_queue')
          .update({ 
            status: 'error',
            error_message: 'Failed to fetch webhook configuration',
            processed_at: new Date().toISOString()
          })
          .eq('id', id);
        continue;
      }

      if (!settings || !settings.setting_value) {
        console.warn('⚠️ N8N webhook URL not configured');
        await supabaseClient
          .from('n8n_notification_queue')
          .update({ 
            status: 'error',
            error_message: 'N8N webhook not configured',
            processed_at: new Date().toISOString()
          })
          .eq('id', id);
        continue;
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

      try {
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
          await supabaseClient
            .from('n8n_notification_queue')
            .update({ 
              status: 'error',
              error_message: `HTTP ${n8nResponse.status}: ${errorText}`,
              processed_at: new Date().toISOString()
            })
            .eq('id', id);
          results.push({ id, status: 'error', error: errorText });
          continue;
        }

        console.log(`✅ Successfully notified N8N for notification ${id}`);
        
        // Marcar como processado
        await supabaseClient
          .from('n8n_notification_queue')
          .update({ 
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', id);
          
        results.push({ id, status: 'completed' });
        
      } catch (fetchError) {
        console.error('❌ Error calling N8N:', fetchError);
        await supabaseClient
          .from('n8n_notification_queue')
          .update({ 
            status: 'error',
            error_message: fetchError.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', id);
        results.push({ id, status: 'error', error: fetchError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Queue processing completed',
        results
      }),
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