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
    const authToken = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(authToken);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Pegar dados do body (agora com token ao invés de dados do cartão)
    const { planType, token, payerEmail, identificationType, identificationNumber } = await req.json();
    
    // Definir valores
    const prices = {
      monthly: { amount: 12.90, title: "BioPeak Pro - Mensal" },
      annual: { amount: 154.80, title: "BioPeak Pro - Anual" }
    };
    
    const selectedPlan = prices[planType as keyof typeof prices];
    if (!selectedPlan) throw new Error("Invalid plan type");

    // Validar token
    if (!token) throw new Error("Card token is required");

    // Pegar token do Mercado Pago
    const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpAccessToken) throw new Error("MercadoPago access token not configured");

    console.log("[MP] Processing payment with token:", {
      user_id: user.id,
      plan: planType,
      amount: selectedPlan.amount,
      has_token: !!token
    });

    // Criar pagamento via API do Mercado Pago
    const paymentBody = {
      transaction_amount: selectedPlan.amount,
      description: selectedPlan.title,
      payment_method_id: "visa", // Será detectado pelo token
      token: token, // Token seguro do cartão
      installments: 1,
      payer: {
        email: payerEmail || user.email,
        identification: {
          type: identificationType,
          number: identificationNumber
        }
      },
      statement_descriptor: "BIOPEAK PRO",
      external_reference: `BIOPEAK_${user.id.substring(0, 8)}_${planType.toUpperCase()}_${Date.now()}`,
      metadata: {
        user_id: user.id,
        user_email: user.email,
        plan_type: planType,
        plan_name: selectedPlan.title,
        source: "transparent_checkout",
        integration_version: "v2.0"
      }
    };

    console.log("[MP] Calling Mercado Pago API...");

    // Chamar API do Mercado Pago
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mpAccessToken}`,
        "X-Idempotency-Key": `${user.id}-${planType}-${Date.now()}`
      },
      body: JSON.stringify(paymentBody)
    });

    const paymentResult = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("[MP] Payment failed:", paymentResult);
      throw new Error(paymentResult.message || "Payment processing failed");
    }

    console.log("[MP] Payment processed:", {
      id: paymentResult.id,
      status: paymentResult.status,
      status_detail: paymentResult.status_detail
    });

    // Registrar pagamento na tabela
    const { error: insertError } = await supabaseClient
      .from("mercadopago_payments")
      .insert({
        user_id: user.id,
        payment_id: paymentResult.id,
        status: paymentResult.status,
        plan_type: planType,
        amount_cents: Math.round(selectedPlan.amount * 100),
        currency: "BRL",
        payer_email: payerEmail || user.email,
        payment_type: "transparent_checkout"
      });

    if (insertError) {
      console.error("[MP] Error inserting payment record:", insertError);
    }

    // Se aprovado, atualizar assinatura do usuário
    if (paymentResult.status === "approved") {
      const subscriptionEnd = new Date();
      if (planType === "monthly") {
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
      } else {
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
      }

      const { error: subError } = await supabaseClient
        .from("subscribers")
        .upsert({
          user_id: user.id,
          subscribed: true,
          subscription_type: planType,
          subscription_tier: "Premium",
          subscription_end: subscriptionEnd.toISOString(),
          payment_source: "mercadopago",
          updated_at: new Date().toISOString()
        });

      if (subError) {
        console.error("[MP] Error updating subscription:", subError);
      } else {
        console.log("[MP] Subscription activated for user:", user.id);
      }
    }

    return new Response(JSON.stringify({ 
      status: paymentResult.status,
      status_detail: paymentResult.status_detail,
      payment_id: paymentResult.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[MP] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: "error"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
