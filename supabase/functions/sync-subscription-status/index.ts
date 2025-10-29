import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body with validation
    const body = await req.text();
    if (!body || body.trim() === '') {
      console.error('❌ Empty body received');
      return new Response(
        JSON.stringify({ error: 'Empty body - expected JSON with user_id, platform, subscribed, expiration_date' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const { user_id, platform, subscribed, expiration_date } = parsedBody;

    console.log('📥 Syncing subscription:', { user_id, platform, subscribed, expiration_date });

    if (!user_id) {
      throw new Error('user_id is required');
    }

    // Update subscribers table
    const { error: updateError } = await supabase
      .from('subscribers')
      .upsert({
        user_id,
        subscribed,
        subscription_type: platform === 'ios' ? 'iap' : 'stripe',
        subscription_tier: subscribed ? 'premium' : null,
        subscription_end: expiration_date,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('❌ Failed to update subscribers:', updateError);
      throw updateError;
    }

    // Insert into subscription_updates to trigger Realtime notification
    const { error: notificationError } = await supabase
      .from('subscription_updates')
      .insert({
        user_id,
        action: subscribed ? 'subscription_activated' : 'subscription_deleted',
        metadata: { platform, expiration_date }
      });

    if (notificationError) {
      console.error('⚠️ Failed to insert notification:', notificationError);
      // Don't throw - subscription was synced successfully
    } else {
      console.log('🔔 Realtime notification sent');
    }

    console.log('✅ Subscription synced successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Subscription synced' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error syncing subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
