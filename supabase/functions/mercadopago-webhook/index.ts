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

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const payload = await req.json();
    console.log("[MP Webhook] Received notification:", JSON.stringify(payload));

    // Mercado Pago envia notificações com diferentes tipos
    if (payload.type === "payment") {
      const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      
      // Buscar detalhes do pagamento
      const paymentId = payload.data.id;
      console.log("[MP Webhook] Fetching payment details for:", paymentId);

      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          "Authorization": `Bearer ${mpAccessToken}`
        }
      });

      if (!paymentResponse.ok) {
        throw new Error(`Failed to fetch payment: ${paymentResponse.status}`);
      }

      const paymentData = await paymentResponse.json();
      console.log("[MP Webhook] Payment data:", JSON.stringify(paymentData));

      const userId = paymentData.external_reference; // user_id que enviamos
      const status = paymentData.status; // approved, rejected, pending, cancelled
      const planType = paymentData.metadata?.plan_type || "monthly";

      // Atualizar registro de pagamento
      const { error: updateError } = await supabaseService
        .from("mercadopago_payments")
        .update({
          payment_id: paymentId.toString(),
          status: status,
          payment_method: paymentData.payment_method_id,
          payment_type_id: paymentData.payment_type_id,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("status", "pending");

      if (updateError) {
        console.error("[MP Webhook] Error updating payment:", updateError);
      } else {
        console.log("[MP Webhook] Payment updated successfully");
      }

      // Se aprovado, ativar assinatura
      if (status === "approved") {
        const subscriptionEnd = new Date();
        
        if (planType === "annual") {
          subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
        } else {
          subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        }

        console.log("[MP Webhook] Activating subscription for user:", userId, "until:", subscriptionEnd);

        // Atualizar tabela subscribers
        const { error: subError } = await supabaseService
          .from("subscribers")
          .upsert({
            user_id: userId,
            subscribed: true,
            subscription_tier: planType,
            subscription_end: subscriptionEnd.toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: "user_id"
          });

        if (subError) {
          console.error("[MP Webhook] Error updating subscription:", subError);
        } else {
          console.log("[MP Webhook] Subscription activated successfully");
        }
      }
    } else {
      console.log("[MP Webhook] Ignoring notification type:", payload.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[MP Webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
