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

    // Get Stripe secret key from Supabase secrets (primary) or env (fallback)
    let stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    let keySource = "secrets";
    
    if (!stripeKey) {
      stripeKey = Deno.env.get("STRIPE_SECRET_KEY_FALLBACK") || "";
      keySource = "env-fallback";
    }
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured in Supabase secrets or environment");
    }

    // Detect Stripe mode (test/live) from key prefix
    const isLiveMode = stripeKey.startsWith("sk_live_");
    const isTestMode = stripeKey.startsWith("sk_test_");
    const stripeMode = isLiveMode ? "live" : isTestMode ? "test" : "unknown";
    
    console.log(`[CHECKOUT] Stripe key mode: ${stripeMode} (source: ${keySource})`);

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://grcwlmltlcltmwbhdpky.supabase.co";

    // Get monthly price ID with environment-aware fallback
    let monthlyPriceId: string = "";
    let priceSource = "env";
    
    try {
      // Try environment-specific price ID first
      const envSpecificKey = `stripe_price_monthly_id_${stripeMode}`;
      const { data: envSetting, error: envError } = await supabaseService
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", envSpecificKey)
        .maybeSingle();
      
      if (!envError && envSetting?.setting_value) {
        monthlyPriceId = envSetting.setting_value;
        priceSource = `db-${stripeMode}`;
      } else {
        // Fallback to generic price ID
        const { data: setting, error: settingError } = await supabaseService
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "stripe_price_monthly_id")
          .maybeSingle();
        
        if (!settingError && setting?.setting_value) {
          monthlyPriceId = setting.setting_value;
          priceSource = "db-generic";
        }
      }
    } catch (e) {
      console.warn("[CHECKOUT] Failed to read price from app_settings:", e);
    }

    // Environment variable fallbacks
    if (!monthlyPriceId) {
      const envSpecificPriceId = Deno.env.get(`STRIPE_PRICE_MONTHLY_ID_${stripeMode.toUpperCase()}`);
      if (envSpecificPriceId) {
        monthlyPriceId = envSpecificPriceId;
        priceSource = `env-${stripeMode}`;
      } else {
        monthlyPriceId = Deno.env.get("STRIPE_PRICE_MONTHLY_ID") || "";
        priceSource = "env-generic";
      }
    }

    console.log(`[CHECKOUT] Using monthly price (${priceSource}): ${monthlyPriceId}`);
    
    if (!monthlyPriceId) {
      throw new Error(`Monthly price ID not configured for ${stripeMode} mode. Please set stripe_price_monthly_id_${stripeMode} in app_settings.`);
    }

    // Validate price ID before creating checkout session
    try {
      await stripe.prices.retrieve(monthlyPriceId);
      console.log(`[CHECKOUT] Price ID validation successful: ${monthlyPriceId}`);
    } catch (priceError: any) {
      console.error(`[CHECKOUT] Price validation failed for ${monthlyPriceId}:`, priceError.message);
      
      if (priceError.code === 'resource_missing') {
        const oppositeMode = stripeMode === 'live' ? 'test' : 'live';
        throw new Error(`Price ID ${monthlyPriceId} not found in ${stripeMode} mode. Check if you're using a ${oppositeMode} price ID with a ${stripeMode} key.`);
      }
      
      throw new Error(`Invalid price ID: ${priceError.message}`);
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