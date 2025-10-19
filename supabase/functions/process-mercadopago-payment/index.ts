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
    const { planType, cardData } = await req.json();
    
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

    console.log("[MP] Processing direct payment:", {
      user_id: user.id,
      plan: planType,
      amount: selectedPlan.amount
    });

    // Criar pagamento direto via API do Mercado Pago
    const payment = {
      transaction_amount: selectedPlan.amount,
      description: selectedPlan.title,
      payment_method_id: "visa", // Será detectado automaticamente
      payer: {
        email: user.email,
        identification: {
          type: cardData.identificationType,
          number: cardData.identificationNumber
        }
      },
      token: null, // Será gerado pelo SDK no frontend
      installments: 1,
      statement_descriptor: "BIOPEAK PRO",
      metadata: {
        user_id: user.id,
        user_email: user.email,
        plan_type: planType,
        plan_name: selectedPlan.title,
        source: "transparent_checkout",
        integration_version: "v2.0"
      },
      additional_info: {
        items: [
          {
            id: planType,
            title: selectedPlan.title,
            description: planType === 'monthly' 
              ? "Acesso completo aos recursos premium do BioPeak"
              : "Acesso completo aos recursos premium do BioPeak por 12 meses",
            quantity: 1,
            unit_price: selectedPlan.amount,
            category_id: "services"
          }
        ],
        payer: {
          first_name: user.user_metadata?.display_name || user.email?.split('@')[0] || "Cliente",
          last_name: "BioPeak",
          phone: {
            area_code: "",
            number: ""
          },
          address: {
            zip_code: "",
            street_name: ""
          }
        }
      }
    };

    // Por enquanto, simular processamento do pagamento
    // Em produção, você usaria o SDK do Mercado Pago para tokenizar o cartão
    // e processar o pagamento de forma segura
    
    console.log("[MP] Payment structure prepared:", {
      amount: payment.transaction_amount,
      description: payment.description,
      user_id: user.id
    });

    // NOTA IMPORTANTE: Esta é uma implementação simplificada
    // Para produção, você precisa:
    // 1. Usar o SDK do Mercado Pago no frontend para tokenizar o cartão
    // 2. Enviar apenas o token (não os dados do cartão) para o backend
    // 3. Processar o pagamento usando o token

    // Simulação de resposta aprovada para teste
    const mockResponse = {
      id: `mock_${Date.now()}`,
      status: "approved",
      status_detail: "accredited",
      transaction_amount: selectedPlan.amount,
      payer: { email: user.email },
      metadata: payment.metadata
    };

    console.log("[MP] Mock payment response:", mockResponse);

    // Registrar pagamento na tabela
    const { error: insertError } = await supabaseClient
      .from("mercadopago_payments")
      .insert({
        user_id: user.id,
        payment_id: mockResponse.id,
        status: mockResponse.status,
        plan_type: planType,
        amount_cents: Math.round(selectedPlan.amount * 100),
        currency: "BRL",
        payer_email: user.email,
        payment_type: "transparent_checkout"
      });

    if (insertError) {
      console.error("[MP] Error inserting payment record:", insertError);
    }

    // Se aprovado, atualizar assinatura do usuário
    if (mockResponse.status === "approved") {
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
      status: mockResponse.status,
      status_detail: mockResponse.status_detail,
      payment_id: mockResponse.id
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
