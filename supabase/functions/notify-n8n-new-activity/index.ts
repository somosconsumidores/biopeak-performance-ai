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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
        },
      }
    );

    // Buscar notificações pendentes da fila
    const { data: pendingNotifications, error: queueError } = await supabaseClient
      .from('n8n_activity_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3)  // Max 3 tentativas
      .order('created_at', { ascending: true })
      .limit(20);

    if (queueError) {
      console.error('❌ Error fetching queue:', queueError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notification queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('ℹ️ No pending activity notifications in queue');
      return new Response(
        JSON.stringify({ message: 'No pending notifications' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Processing ${pendingNotifications.length} pending activity notifications`);
    
    const results = [];
    const webhookUrl = 'https://biopeak-ai.app.n8n.cloud/webhook/new-training-activity';
    
    for (const notification of pendingNotifications) {
      const { id, user_id, activity_id, activity_type, retry_count } = notification;

      console.log(`📤 Processing notification ${id} for user: ${user_id}, activity: ${activity_id}`);

      try {
        const payload = {
          user_id,
          activity_id,
          activity_type,
          timestamp: new Date().toISOString(),
          source: 'BioPeak Activity Queue',
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          console.log(`✅ Successfully notified n8n for notification ${id}`);
          
          await supabaseClient
            .from('n8n_activity_notification_queue')
            .update({ 
              status: 'completed',
              processed_at: new Date().toISOString()
            })
            .eq('id', id);
            
          results.push({ id, status: 'completed' });
        } else {
          const errorText = await response.text();
          const newRetryCount = retry_count + 1;
          const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';
          
          console.error(`❌ n8n webhook failed for ${id}:`, { status: response.status, error: errorText });
          
          await supabaseClient
            .from('n8n_activity_notification_queue')
            .update({ 
              retry_count: newRetryCount,
              error_message: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
              status: newStatus,
              processed_at: newStatus === 'failed' ? new Date().toISOString() : null
            })
            .eq('id', id);
            
          results.push({ id, status: newStatus, error: `HTTP ${response.status}` });
        }
      } catch (fetchError) {
        const newRetryCount = retry_count + 1;
        const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';
        
        console.error(`❌ Network error for ${id}:`, fetchError);
        
        await supabaseClient
          .from('n8n_activity_notification_queue')
          .update({ 
            retry_count: newRetryCount,
            error_message: fetchError.message?.substring(0, 500) || 'Network error',
            status: newStatus,
            processed_at: newStatus === 'failed' ? new Date().toISOString() : null
          })
          .eq('id', id);
          
        results.push({ id, status: newStatus, error: fetchError.message });
      }
    }

    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const retrying = results.filter(r => r.status === 'pending').length;

    console.log(`📊 Queue processing completed: ${completed} completed, ${retrying} retrying, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        message: 'Queue processing completed',
        summary: { completed, retrying, failed },
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in notify-n8n-new-activity:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
