// Stripe webhook handler for processing payment events
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  logStep("Webhook received", { method: req.method, url: req.url });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate secrets first
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  
  if (!stripeSecretKey || !webhookSecret) {
    logStep("ERROR: Missing required secrets", {
      hasStripeKey: !!stripeSecretKey,
      hasWebhookSecret: !!webhookSecret
    });
    return new Response(
      JSON.stringify({ 
        error: "Server configuration error - missing secrets",
        configured: {
          stripe_key: !!stripeSecretKey,
          webhook_secret: !!webhookSecret
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-08-27.basil",
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let event: Stripe.Event;

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: No signature in request");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const body = await req.text();
    logStep("Request body received", { 
      bodyLength: body.length,
      hasSignature: !!signature
    });
    
    // Verify webhook signature
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
      logStep("Signature verified successfully", { eventType: event.type });
    } catch (err) {
      logStep("ERROR: Signature verification failed", { 
        error: err instanceof Error ? err.message : String(err)
      });
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    logStep('Processing event', { type: event.type, id: event.id });

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Processing checkout session:', {
        sessionId: session.id,
        paymentIntent: session.payment_intent,
        metadata: session.metadata,
      });

      // Update ai_analysis_purchases if this is an AI analysis purchase
      if (session.metadata?.purchase_type === 'ai_analysis') {
        const { error } = await supabaseAdmin
          .from('ai_analysis_purchases')
          .update({
            status: 'completed',
            purchased_at: new Date().toISOString(),
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
      console.log('Payment intent succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        metadata: paymentIntent.metadata,
      });

      // Get the checkout session associated with this payment intent
      try {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntent.id,
          limit: 1,
        });

        if (sessions.data.length > 0) {
          const session = sessions.data[0];
          console.log('Found associated session:', session.id);

          // Update ai_analysis_purchases using the session ID
          const { data: existingPurchase } = await supabaseAdmin
            .from('ai_analysis_purchases')
            .select('*')
            .eq('stripe_payment_intent_id', session.id)
            .maybeSingle();

          if (existingPurchase && existingPurchase.status === 'pending') {
            const { error } = await supabaseAdmin
              .from('ai_analysis_purchases')
              .update({
                status: 'completed',
                purchased_at: new Date().toISOString(),
              })
              .eq('stripe_payment_intent_id', session.id);

            if (error) {
              console.error('Error updating ai_analysis_purchases via payment_intent:', error);
            } else {
              console.log('AI analysis purchase completed via payment_intent:', {
                paymentIntentId: paymentIntent.id,
                sessionId: session.id,
              });
            }
          } else if (!existingPurchase) {
            console.log('No pending purchase found for session:', session.id);
          } else {
            console.log('Purchase already completed for session:', session.id);
          }
        } else {
          console.log('No checkout session found for payment intent:', paymentIntent.id);
        }
      } catch (error) {
        console.error('Error fetching checkout session for payment intent:', error);
      }
    }

    logStep('Event processed successfully', { type: event.type, id: event.id });
    return new Response(
      JSON.stringify({ received: true, eventType: event.type }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR: Event processing failed', { 
      error: errorMessage,
      eventType: event?.type,
      eventId: event?.id
    });
    
    // Return 200 to Stripe to acknowledge receipt, but log the error
    // This prevents Stripe from retrying valid events that fail processing
    return new Response(
      JSON.stringify({ 
        received: true, 
        error: errorMessage,
        eventType: event?.type 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
