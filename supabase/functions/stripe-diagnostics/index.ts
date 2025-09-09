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

  try {
    console.log("[STRIPE-DIAGNOSTICS] Function started");

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get Stripe secret key
    let stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    let keySource = "secrets";
    
    if (!stripeKey) {
      stripeKey = Deno.env.get("STRIPE_SECRET_KEY_FALLBACK") || "";
      keySource = "env-fallback";
    }
    
    if (!stripeKey) {
      return new Response(JSON.stringify({
        error: "STRIPE_SECRET_KEY not configured",
        keySource: "none"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Detect Stripe mode
    const isLiveMode = stripeKey.startsWith("sk_live_");
    const isTestMode = stripeKey.startsWith("sk_test_");
    const stripeMode = isLiveMode ? "live" : isTestMode ? "test" : "unknown";

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get all price IDs from app_settings
    const { data: settings, error: settingsError } = await supabaseService
      .from("app_settings")
      .select("setting_key, setting_value")
      .like("setting_key", "stripe_price_%");

    const priceConfig: Record<string, string | null> = {};
    const priceValidation: Record<string, { valid: boolean; error?: string }> = {};

    if (!settingsError && settings) {
      for (const setting of settings) {
        priceConfig[setting.setting_key] = setting.setting_value;
        
        // Test each price ID if it exists
        if (setting.setting_value) {
          try {
            await stripe.prices.retrieve(setting.setting_value);
            priceValidation[setting.setting_key] = { valid: true };
          } catch (error: any) {
            priceValidation[setting.setting_key] = { 
              valid: false, 
              error: error.message 
            };
          }
        }
      }
    }

    // Get environment price IDs
    const envPrices = {
      STRIPE_PRICE_MONTHLY_ID: Deno.env.get("STRIPE_PRICE_MONTHLY_ID") || null,
      STRIPE_PRICE_ANNUAL_ID: Deno.env.get("STRIPE_PRICE_ANNUAL_ID") || null,
      [`STRIPE_PRICE_MONTHLY_ID_${stripeMode.toUpperCase()}`]: Deno.env.get(`STRIPE_PRICE_MONTHLY_ID_${stripeMode.toUpperCase()}`) || null,
      [`STRIPE_PRICE_ANNUAL_ID_${stripeMode.toUpperCase()}`]: Deno.env.get(`STRIPE_PRICE_ANNUAL_ID_${stripeMode.toUpperCase()}`) || null,
    };

    // Test environment price IDs
    const envPriceValidation: Record<string, { valid: boolean; error?: string }> = {};
    for (const [key, priceId] of Object.entries(envPrices)) {
      if (priceId) {
        try {
          await stripe.prices.retrieve(priceId);
          envPriceValidation[key] = { valid: true };
        } catch (error: any) {
          envPriceValidation[key] = { 
            valid: false, 
            error: error.message 
          };
        }
      }
    }

    // Recommendations
    const recommendations: string[] = [];
    
    if (stripeMode === "unknown") {
      recommendations.push("STRIPE_SECRET_KEY format not recognized. Expected sk_live_ or sk_test_ prefix.");
    }
    
    const currentModeMonthly = `stripe_price_monthly_id_${stripeMode}`;
    const currentModeAnnual = `stripe_price_annual_id_${stripeMode}`;
    
    if (!priceConfig[currentModeMonthly]) {
      recommendations.push(`Consider setting ${currentModeMonthly} in app_settings for ${stripeMode} mode.`);
    }
    
    if (!priceConfig[currentModeAnnual]) {
      recommendations.push(`Consider setting ${currentModeAnnual} in app_settings for ${stripeMode} mode.`);
    }

    const diagnostics = {
      stripe: {
        keyMode: stripeMode,
        keySource,
        keyMasked: stripeKey.slice(0, 8) + "***"
      },
      priceConfig: {
        database: priceConfig,
        environment: envPrices
      },
      validation: {
        database: priceValidation,
        environment: envPriceValidation
      },
      recommendations,
      timestamp: new Date().toISOString()
    };

    console.log("[STRIPE-DIAGNOSTICS] Diagnostics completed", { mode: stripeMode, validations: Object.keys(priceValidation).length });

    return new Response(JSON.stringify(diagnostics, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[STRIPE-DIAGNOSTICS] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});