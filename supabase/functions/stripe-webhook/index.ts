// Stripe webhook handler for processing payment events
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No signature provided");
    }

    const body = await req.text();
    
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log('Stripe webhook event received:', event.type);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Processing checkout session:', session.id);

      // Update ai_analysis_purchases if this is an AI analysis purchase
      if (session.metadata?.purchase_type === 'ai_analysis') {
        const { error } = await supabaseAdmin
          .from('ai_analysis_purchases')
          .update({
            status: 'completed',
            purchased_at: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .eq('stripe_payment_intent_id', session.id);

        if (error) {
          console.error('Error updating ai_analysis_purchases:', error);
          throw error;
        }

        console.log('AI analysis purchase completed:', {
          sessionId: session.id,
          userId: session.metadata.user_id,
          activityId: session.metadata.activity_id,
        });
      }

      // Update faturamento table for subscription or payment tracking
      const { error: faturamentoError } = await supabaseAdmin
        .from('faturamento')
        .insert({
          user_id: session.metadata?.user_id,
          stripe_customer_id: session.customer as string,
          stripe_payment_id: (session.payment_intent || session.id) as string,
          tipo_pagamento: session.mode === 'subscription' ? 'subscription' : 'one_time',
          status: 'paid',
          valor_centavos: session.amount_total || 0,
          moeda: session.currency?.toUpperCase() || 'BRL',
          data_pagamento: new Date().toISOString(),
          descricao: session.metadata?.purchase_type === 'ai_analysis' 
            ? 'Análise de IA' 
            : 'Pagamento',
          metadata: session.metadata || {},
        });

      if (faturamentoError) {
        console.error('Error inserting faturamento:', faturamentoError);
      }
    }

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('Payment intent succeeded:', paymentIntent.id);

      // Update ai_analysis_purchases if not already updated
      const { data: existingPurchase } = await supabaseAdmin
        .from('ai_analysis_purchases')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle();

      if (existingPurchase && existingPurchase.status === 'pending') {
        const { error } = await supabaseAdmin
          .from('ai_analysis_purchases')
          .update({
            status: 'completed',
            purchased_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        if (error) {
          console.error('Error updating ai_analysis_purchases:', error);
        } else {
          console.log('AI analysis purchase completed via payment_intent:', paymentIntent.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
