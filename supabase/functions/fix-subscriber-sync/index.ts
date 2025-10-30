import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { user_id, stripe_customer_id, subscription_end, admin_key } = await req.json();
    
    // Simple admin key check for security
    const expectedKey = Deno.env.get("ADMIN_FIX_KEY") || "fix-2025";
    if (admin_key !== expectedKey) {
      throw new Error("Unauthorized - invalid admin key");
    }
    
    console.log('🔧 Fixing subscriber sync for user:', user_id);

    // Update subscriber record
    const { data, error } = await supabaseAdmin
      .from('subscribers')
      .update({
        stripe_customer_id: stripe_customer_id,
        subscribed: true,
        subscription_type: 'monthly',
        subscription_tier: 'Premium',
        subscription_end: subscription_end,
        subscription_source: 'stripe',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .select();

    if (error) {
      console.error('❌ Error updating subscriber:', error);
      throw error;
    }

    console.log('✅ Subscriber synced successfully:', data);

    // Insert notification to subscription_updates
    await supabaseAdmin.from('subscription_updates').insert({
      user_id: user_id,
      action: 'subscription_fixed',
      metadata: {
        stripe_customer_id: stripe_customer_id,
        subscription_end: subscription_end,
        fixed_at: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Subscriber synced successfully',
        data 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error in fix-subscriber-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
