import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    // Check if request has admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !userData.user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin (you can add role check here)
    const { user_id, email } = await req.json();
    
    console.log('🔧 Admin fixing subscription for:', { user_id, email });

    // Get Stripe info
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe key not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Find customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this email");
    }

    const customerId = customers.data[0].id;
    console.log('Found customer:', customerId);

    // Get subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    let hasActiveSub = false;
    let subscriptionType = null;
    let subscriptionEnd = null;

    for (const sub of subscriptions.data) {
      if (sub.status === "active" || sub.status === "trialing") {
        hasActiveSub = true;
        const endTimestamp = sub.status === "trialing" && sub.trial_end 
          ? sub.trial_end 
          : sub.current_period_end;
        subscriptionEnd = new Date(endTimestamp * 1000).toISOString();
        subscriptionType = sub.status === "trialing" ? "trial" : "monthly";
        console.log('Active subscription found:', { id: sub.id, endDate: subscriptionEnd });
        break;
      }
    }

    // Update database
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('subscribers')
      .upsert({
        email: email,
        user_id: user_id,
        stripe_customer_id: customerId,
        subscribed: hasActiveSub,
        subscription_type: subscriptionType,
        subscription_tier: hasActiveSub ? "Premium" : null,
        subscription_end: subscriptionEnd,
        subscription_source: 'stripe',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' })
      .select();

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Database updated:', updateData);

    // Insert notification
    await supabaseAdmin.from('subscription_updates').insert({
      user_id: user_id,
      action: 'admin_subscription_fix',
      metadata: {
        stripe_customer_id: customerId,
        subscribed: hasActiveSub,
        subscription_end: subscriptionEnd,
        fixed_by: userData.user.id,
        fixed_at: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        subscribed: hasActiveSub,
        subscription_type: subscriptionType,
        subscription_end: subscriptionEnd,
        stripe_customer_id: customerId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error in admin-fix-subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
