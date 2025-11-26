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
      event = await stripe.webhooks.constructEventAsync(
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

      // Strategy to find user_id with fallback mechanisms
      let userId = session.metadata?.user_id;
      
      if (!userId) {
        logStep('No user_id in metadata, attempting fallback strategies', {
          customerId: session.customer as string,
          customerEmail: session.customer_details?.email
        });

        // Fallback 1: Try to find user by stripe_customer_id in profiles
        if (session.customer) {
          const { data: profileByCustomer } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('stripe_customer_id', session.customer as string)
            .maybeSingle();
          
          if (profileByCustomer?.user_id) {
            userId = profileByCustomer.user_id;
            logStep('Found user via stripe_customer_id', { userId, method: 'stripe_customer_id' });
          }
        }

        // Fallback 2: Try to find user by email
        if (!userId && session.customer_details?.email) {
          const { data: profileByEmail } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', session.customer_details.email)
            .maybeSingle();
          
          if (profileByEmail?.user_id) {
            userId = profileByEmail.user_id;
            logStep('Found user via email', { userId, email: session.customer_details.email, method: 'email' });
          }
        }

        // Fallback 3: If still no user_id, try to get email from Stripe customer
        if (!userId && session.customer) {
          try {
            const customer = await stripe.customers.retrieve(session.customer as string);
            if (customer && !customer.deleted && customer.email) {
              const { data: profileByCustomerEmail } = await supabaseAdmin
                .from('profiles')
                .select('user_id')
                .eq('email', customer.email)
                .maybeSingle();
              
              if (profileByCustomerEmail?.user_id) {
                userId = profileByCustomerEmail.user_id;
                logStep('Found user via Stripe customer email', { userId, email: customer.email, method: 'stripe_customer_email' });
              }
            }
          } catch (stripeError) {
            logStep('Error retrieving Stripe customer', { error: stripeError instanceof Error ? stripeError.message : String(stripeError) });
          }
        }

        if (!userId) {
          logStep('ERROR: Could not find user_id after all fallback attempts', {
            sessionId: session.id,
            customer: session.customer,
            email: session.customer_details?.email
          });
        }
      } else {
        logStep('Using user_id from metadata', { userId });
      }

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
      // Only insert if we have a user_id
      if (userId) {
        const { error: faturamentoError } = await supabaseAdmin
          .from('faturamento')
          .insert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_payment_id: (session.payment_intent || session.id) as string,
            tipo_pagamento: session.mode === 'subscription' ? 'subscription' : 'one_time',
            status: 'succeeded',
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
        } else {
          logStep('Successfully inserted faturamento record', { userId, sessionId: session.id });
        }

        // Update subscribers table if this is a subscription
        if (session.mode === 'subscription' && session.customer) {
          // Get user email from profiles
          const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('user_id', userId)
            .maybeSingle();

          if (userProfile?.email) {
            const { error: subscriberError } = await supabaseAdmin
              .from('subscribers')
              .upsert({
                user_id: userId,
                email: userProfile.email,
                stripe_customer_id: session.customer as string,
                subscribed: true,
                subscription_type: 'stripe',
                subscription_tier: 'premium',
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });

            if (subscriberError) {
              console.error('Error upserting subscriber:', subscriberError);
            } else {
              logStep('Successfully upserted subscriber', { userId, email: userProfile.email });
            }
          }
        }
      } else {
        logStep('Skipping faturamento insert - no user_id found', { sessionId: session.id });
      }
    }

    // Handle customer.subscription.updated event
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      
      logStep('Subscription updated', { 
        subscriptionId: subscription.id, 
        status: subscription.status,
        customerId: subscription.customer
      });
      
      // Find user by customer_id - try profiles first, then subscribers
      let profile = await supabaseAdmin
        .from('profiles')
        .select('user_id, email')
        .eq('stripe_customer_id', subscription.customer as string)
        .maybeSingle()
        .then(res => res.data);

      // Fallback: search in subscribers table
      if (!profile) {
        logStep('Profile not found, trying subscribers table', { customerId: subscription.customer });
        const { data: subscriber } = await supabaseAdmin
          .from('subscribers')
          .select('user_id, email')
          .eq('stripe_customer_id', subscription.customer as string)
          .maybeSingle();
        
        if (subscriber) {
          profile = subscriber;
          logStep('Found user via subscribers table', { userId: subscriber.user_id });
        }
      }
      
      if (profile) {
        const isActive = subscription.status === 'active';
        
        await supabaseAdmin.from('subscribers').upsert({
          user_id: profile.user_id,
          email: profile.email,
          stripe_customer_id: subscription.customer as string,
          subscribed: isActive,
          subscription_type: isActive ? 'stripe' : null,
          subscription_tier: isActive ? 'premium' : null,
          subscription_end: isActive 
            ? new Date(subscription.current_period_end * 1000).toISOString() 
            : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        
        // Notificar apps via Realtime
        if (profile?.user_id) {
          await supabaseAdmin
            .from('subscription_updates')
            .insert({
              user_id: profile.user_id,
              action: 'subscription_updated',
              metadata: {
                subscription_id: subscription.id,
                status: subscription.status,
                subscribed: isActive
              }
            });
          
          logStep('Realtime notification sent', { userId: profile.user_id });
        }
        
        logStep('Subscription status updated in database', { 
          userId: profile.user_id, 
          subscribed: isActive,
          status: subscription.status
        });
      } else {
        logStep('No profile found for customer', { customerId: subscription.customer });
      }
    }

    // Handle customer.subscription.deleted event
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      
      logStep('Subscription deleted', { 
        subscriptionId: subscription.id, 
        customerId: subscription.customer
      });
      
      // Find user by customer_id - try profiles first, then subscribers
      let profile = await supabaseAdmin
        .from('profiles')
        .select('user_id, email')
        .eq('stripe_customer_id', subscription.customer as string)
        .maybeSingle()
        .then(res => res.data);

      // Fallback: search in subscribers table
      if (!profile) {
        logStep('Profile not found, trying subscribers table', { customerId: subscription.customer });
        const { data: subscriber } = await supabaseAdmin
          .from('subscribers')
          .select('user_id, email')
          .eq('stripe_customer_id', subscription.customer as string)
          .maybeSingle();
        
        if (subscriber) {
          profile = subscriber;
          logStep('Found user via subscribers table', { userId: subscriber.user_id });
        }
      }
      
      if (profile) {
        await supabaseAdmin.from('subscribers').upsert({
          user_id: profile.user_id,
          email: profile.email,
          stripe_customer_id: subscription.customer as string,
          subscribed: false,
          subscription_type: null,
          subscription_tier: null,
          subscription_end: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        
        // Notificar apps via Realtime
        if (profile?.user_id) {
          await supabaseAdmin
            .from('subscription_updates')
            .insert({
              user_id: profile.user_id,
              action: 'subscription_deleted',
              metadata: {
                subscription_id: subscription.id
              }
            });
          
          logStep('Realtime notification sent', { userId: profile.user_id });
        }
        
        logStep('User marked as unsubscribed due to subscription deletion', { 
          userId: profile.user_id,
          subscriptionId: subscription.id
        });
      } else {
        logStep('No profile found for customer', { customerId: subscription.customer });
      }
    }

    // Handle invoice.payment_failed event
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      
      logStep('Payment failed', { 
        invoiceId: invoice.id, 
        customerId: invoice.customer,
        subscriptionId: invoice.subscription
      });
      
      // Find user by customer_id - try profiles first, then subscribers
      let profile = await supabaseAdmin
        .from('profiles')
        .select('user_id, email')
        .eq('stripe_customer_id', invoice.customer as string)
        .maybeSingle()
        .then(res => res.data);

      // Fallback: search in subscribers table
      if (!profile) {
        logStep('Profile not found, trying subscribers table', { customerId: invoice.customer });
        const { data: subscriber } = await supabaseAdmin
          .from('subscribers')
          .select('user_id, email')
          .eq('stripe_customer_id', invoice.customer as string)
          .maybeSingle();
        
        if (subscriber) {
          profile = subscriber;
          logStep('Found user via subscribers table', { userId: subscriber.user_id });
        }
      }
      
      if (profile) {
        // Mark as unsubscribed due to payment failure
        await supabaseAdmin.from('subscribers').upsert({
          user_id: profile.user_id,
          email: profile.email,
          stripe_customer_id: invoice.customer as string,
          subscribed: false,
          subscription_type: null,
          subscription_tier: null,
          subscription_end: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        
        // Notificar apps via Realtime
        if (profile?.user_id) {
          await supabaseAdmin
            .from('subscription_updates')
            .insert({
              user_id: profile.user_id,
              action: 'payment_failed',
              metadata: {
                invoice_id: invoice.id
              }
            });
          
          logStep('Realtime notification sent', { userId: profile.user_id });
        }
        
        logStep('User marked as unsubscribed due to payment failure', { 
          userId: profile.user_id,
          invoiceId: invoice.id
        });
      } else {
        logStep('No profile found for customer', { customerId: invoice.customer });
      }
    }

    // Handle invoice.payment_succeeded event (recurring payments)
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      
      logStep('Invoice payment succeeded', { 
        invoiceId: invoice.id, 
        customerId: invoice.customer,
        customerEmail: invoice.customer_email,
        subscriptionId: invoice.subscription,
        amount: invoice.amount_paid,
        currency: invoice.currency
      });
      
      // Find user by customer_id
      let profile = await supabaseAdmin
        .from('profiles')
        .select('user_id, email')
        .eq('stripe_customer_id', invoice.customer as string)
        .maybeSingle()
        .then(res => res.data);
      
      if (!profile) {
        logStep('No profile found for customer in invoice.payment_succeeded', { 
          customerId: invoice.customer 
        });
        
        // Fallback: try to find user via subscribers table
        const { data: subscriber } = await supabaseAdmin
          .from('subscribers')
          .select('user_id, email')
          .eq('stripe_customer_id', invoice.customer as string)
          .maybeSingle();
        
        if (subscriber) {
          profile = subscriber;
          logStep('Found user via subscribers table', { 
            userId: subscriber.user_id,
            email: subscriber.email 
          });
        }
      }
      
      // Se ainda não encontrou o profile, tentar por email
      if (!profile && invoice.customer_email) {
        const { data: profileByEmail } = await supabaseAdmin
          .from('profiles')
          .select('user_id, email')
          .eq('email', invoice.customer_email)
          .maybeSingle();
        
        if (profileByEmail) {
          profile = profileByEmail;
          logStep('Found user via invoice customer_email', { 
            userId: profileByEmail.user_id,
            email: invoice.customer_email 
          });
          
          // Atualizar o stripe_customer_id no profile para futuras buscas
          await supabaseAdmin
            .from('profiles')
            .update({ stripe_customer_id: invoice.customer as string })
            .eq('user_id', profileByEmail.user_id);
          
          logStep('Updated profile with stripe_customer_id for future lookups');
        }
      }
      
      if (profile) {
        // Get subscription details for metadata
        let subscriptionTier = 'Premium';
        let subscriptionType = 'monthly';
        
        if (invoice.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            
            // Determine tier based on price
            const priceId = subscription.items.data[0]?.price.id;
            if (priceId) {
              // Map price IDs to tiers (adjust based on your actual price IDs)
              if (priceId.includes('annual') || priceId.includes('year')) {
                subscriptionType = 'annual';
              }
            }
            
            logStep('Retrieved subscription details', {
              subscriptionId: subscription.id,
              priceId,
              type: subscriptionType
            });
          } catch (subError) {
            logStep('Error retrieving subscription details', { 
              error: subError instanceof Error ? subError.message : String(subError) 
            });
          }
        }
        
        // Calculate period dates
        const periodoInicio = invoice.period_start 
          ? new Date(invoice.period_start * 1000).toISOString().split('T')[0]
          : null;
        const periodoFim = invoice.period_end 
          ? new Date(invoice.period_end * 1000).toISOString().split('T')[0]
          : null;
        
        // Insert into faturamento table
        const { error: faturamentoError } = await supabaseAdmin
          .from('faturamento')
          .insert({
            user_id: profile.user_id,
            stripe_customer_id: invoice.customer as string,
            stripe_payment_id: invoice.payment_intent as string || invoice.id,
            tipo_pagamento: 'subscription',
            status: invoice.status === 'paid' ? 'succeeded' : invoice.status,
            valor_centavos: invoice.amount_paid,
            moeda: invoice.currency?.toUpperCase() || 'BRL',
            data_pagamento: new Date().toISOString(),
            descricao: `Pagamento de assinatura ${subscriptionType}`,
            periodo_inicio: periodoInicio,
            periodo_fim: periodoFim,
            metadata: {
              invoice_id: invoice.id,
              subscription_id: invoice.subscription,
              subscription_tier: subscriptionTier,
              subscription_type: subscriptionType,
              invoice_number: invoice.number,
              hosted_invoice_url: invoice.hosted_invoice_url,
            },
          });

        if (faturamentoError) {
          logStep('ERROR: Failed to insert faturamento for invoice', {
            error: faturamentoError,
            invoiceId: invoice.id,
            userId: profile.user_id
          });
        } else {
          logStep('Successfully inserted faturamento for recurring payment', { 
            userId: profile.user_id,
            invoiceId: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency
          });
        }
      } else {
        logStep('ERROR: Could not find user for invoice payment', { 
          customerId: invoice.customer,
          invoiceId: invoice.id
        });
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
