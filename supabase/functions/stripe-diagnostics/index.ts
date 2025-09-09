import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const diagnostics = {
      secrets: {
        stripe_publishable_key: !!Deno.env.get("STRIPE_PUBLISHABLE_KEY"),
        stripe_secret_key: !!Deno.env.get("STRIPE_SECRET_KEY"),
        stripe_price_id_monthly: !!Deno.env.get("STRIPE_PRICE_ID_MONTHLY"),
        stripe_price_id_annual: !!Deno.env.get("STRIPE_PRICE_ID_ANNUAL"),
        supabase_url: !!Deno.env.get("SUPABASE_URL"),
        supabase_anon_key: !!Deno.env.get("SUPABASE_ANON_KEY"),
        supabase_service_role_key: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      },
      stripe_key_preview: Deno.env.get("STRIPE_SECRET_KEY")?.substring(0, 12) + "...",
      publishable_key_preview: Deno.env.get("STRIPE_PUBLISHABLE_KEY")?.substring(0, 12) + "...",
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(diagnostics, null, 2), {
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