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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  // Service role client for secure server-side reads/writes (bypass RLS)
  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://grcwlmltlcltmwbhdpky.supabase.co";

    // Resolve monthly price ID from DB (app_settings) with fallback to env
    let monthlyPriceId: string = "";
    let priceSource = "env";
    try {
      const { data: setting, error: settingError } = await supabaseService
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "stripe_price_monthly_id")
        .maybeSingle();
      if (settingError) {
        console.warn("[CHECKOUT] app_settings fetch error:", settingError.message);
      }
      if (setting?.setting_value) {
        monthlyPriceId = setting.setting_value;
        priceSource = "db";
      }
    } catch (e) {
      console.warn("[CHECKOUT] Failed to read price from app_settings:", e);
    }

    if (!monthlyPriceId) {
      monthlyPriceId = Deno.env.get("STRIPE_PRICE_MONTHLY_ID") || "";
      priceSource = "env";
    }

    console.log("[CHECKOUT] Using monthly price (" + priceSource + "):", monthlyPriceId);
    if (!monthlyPriceId) {
      throw new Error("Monthly price ID is not configured (checked DB and STRIPE_PRICE_MONTHLY_ID)");
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: monthlyPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/paywall?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating monthly checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});