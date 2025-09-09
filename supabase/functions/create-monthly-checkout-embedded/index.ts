import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function detectStripeMode(key?: string) {
  if (!key) return "unknown" as const;
  return key.startsWith("sk_live_") ? ("live" as const) : key.startsWith("sk_test_") ? ("test" as const) : ("unknown" as const);
}

function firstDefined(...vals: (string | undefined | null)[]) {
  return vals.find((v) => v && v.trim().length > 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripeMode = detectStripeMode(stripeKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Find or create customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId = customers.data[0]?.id;
    if (!customerId) {
      const cust = await stripe.customers.create({ email: user.email });
      customerId = cust.id;
    }

    // Resolve Price ID (env preferred, fallback to DB app_settings)
    let priceId: string | undefined;
    if (stripeMode === "live") {
      priceId = firstDefined(
        Deno.env.get("STRIPE_PRICE_ID_MONTHLY_LIVE"),
        Deno.env.get("STRIPE_MONTHLY_PRICE_ID_LIVE"),
        Deno.env.get("STRIPE_PRICE_ID_MONTHLY")
      );
    } else if (stripeMode === "test") {
      priceId = firstDefined(
        Deno.env.get("STRIPE_PRICE_ID_MONTHLY_TEST"),
        Deno.env.get("STRIPE_MONTHLY_PRICE_ID_TEST"),
        Deno.env.get("STRIPE_PRICE_ID_MONTHLY")
      );
    } else {
      priceId = Deno.env.get("STRIPE_PRICE_ID_MONTHLY");
    }

    if (!priceId) {
      // Fallback: read from app_settings
      const { data: settings } = await supabaseService
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "stripe_price_id_monthly",
          "stripe_monthly_price_id",
          "stripe_price_id_monthly_live",
          "stripe_price_id_monthly_test",
        ]);
      const map = new Map((settings ?? []).map((s: any) => [String(s.key), String(s.value)]));
      priceId = firstDefined(
        stripeMode === "live"
          ? map.get("stripe_price_id_monthly_live") || map.get("stripe_price_id_monthly") || map.get("stripe_monthly_price_id")
          : stripeMode === "test"
          ? map.get("stripe_price_id_monthly_test") || map.get("stripe_price_id_monthly") || map.get("stripe_monthly_price_id")
          : map.get("stripe_price_id_monthly") || map.get("stripe_monthly_price_id")
      ) as string | undefined;
    }

    if (!priceId) throw new Error("Monthly Stripe price ID not configured");

    const origin = req.headers.get("origin") || "https://grcwlmltlcltmwbhdpky.supabase.co";

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      return_url: `${origin}/paywall?success=true&session_id={CHECKOUT_SESSION_ID}`,
      allow_promotion_codes: true,
      locale: "pt-BR",
    });

    return new Response(JSON.stringify({ client_secret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});