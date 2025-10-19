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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Autenticar usuário
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Pegar dados do body
    const { planType } = await req.json(); // 'monthly' ou 'annual'
    
    // Definir valores
    const prices = {
      monthly: { amount: 12.90, title: "BioPeak Pro - Mensal" },
      annual: { amount: 154.80, title: "BioPeak Pro - Anual" }
    };
    
    const selectedPlan = prices[planType as keyof typeof prices];
    if (!selectedPlan) throw new Error("Invalid plan type");

    // Pegar token do Mercado Pago
    const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpAccessToken) throw new Error("MercadoPago access token not configured");

    const origin = req.headers.get("origin") || "https://grcwlmltlcltmwbhdpky.supabase.co";

    // Criar preferência no Mercado Pago
    const preference = {
      items: [
        {
          title: selectedPlan.title,
          quantity: 1,
          unit_price: selectedPlan.amount,
          currency_id: "BRL"
        }
      ],
      payer: {
        email: user.email,
      },
      back_urls: {
        success: `${origin}/dashboard?mp_success=true`,
        failure: `${origin}/paywall-mercadopago?mp_error=true`,
        pending: `${origin}/paywall-mercadopago?mp_pending=true`
      },
      auto_return: "approved",
      external_reference: user.id, // Para identificar o usuário no webhook
      metadata: {
        user_id: user.id,
        plan_type: planType
      }
    };

    console.log("[MP] Creating preference for user:", user.id, "plan:", planType);

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.text();
      console.error("[MP] Error creating preference:", errorData);
      throw new Error("Failed to create MercadoPago preference");
    }

    const preferenceData = await mpResponse.json();
    console.log("[MP] Preference created:", preferenceData.id);

    // Registrar pagamento pendente na tabela
    const { error: insertError } = await supabaseClient
      .from("mercadopago_payments")
      .insert({
        user_id: user.id,
        preference_id: preferenceData.id,
        status: "pending",
        plan_type: planType,
        amount_cents: Math.round(selectedPlan.amount * 100),
        currency: "BRL",
        payer_email: user.email
      });

    if (insertError) {
      console.error("[MP] Error inserting payment record:", insertError);
    }

    // Retornar init_point (URL de checkout)
    return new Response(JSON.stringify({ 
      url: preferenceData.init_point,
      preference_id: preferenceData.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[MP] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
