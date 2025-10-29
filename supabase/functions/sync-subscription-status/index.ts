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

    // Parse request body
    const { user_id, platform, subscribed, expiration_date } = await req.json();

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
