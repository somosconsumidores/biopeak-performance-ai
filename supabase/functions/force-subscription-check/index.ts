import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FORCE-SUBSCRIPTION-CHECK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { email } = await req.json();
    if (!email) throw new Error("Email is required");
    
    logStep("Function started", { email });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Get user from Supabase
    const { data: user, error } = await supabaseClient.auth.admin.getUserByEmail(email);
    if (error) throw new Error(`Failed to get user: ${error.message}`);
    if (!user) throw new Error("User not found");
    
    logStep("User found", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Comprehensive customer search
    let customers = await stripe.customers.list({ email: user.email, limit: 10 });
    logStep("Customer search by email", { email: user.email, foundCount: customers.data.length });
    
    // If no customer found, try variations and recent sessions
    // If no customer found, try variations + sessions + search API + active subs scan
    if (customers.data.length === 0) {
      const emailVariations = [
        user.email!.toLowerCase().trim(),
        user.email!.trim(),
        user.email!.toLowerCase()
      ];
      
      for (const emailVar of emailVariations) {
        if (emailVar !== user.email) {
          const altCustomers = await stripe.customers.list({ email: emailVar, limit: 10 });
          if (altCustomers.data.length > 0) {
            customers = altCustomers;
            logStep("Found customer with email variation", { originalEmail: user.email, foundEmail: emailVar });
            break;
          }
        }
      }
      
      // Check recent checkout sessions
      if (customers.data.length === 0) {
        const recentSessions = await stripe.checkout.sessions.list({ limit: 100 });
        const userSession = recentSessions.data.find(session => 
          session.customer_email?.toLowerCase() === user.email!.toLowerCase() ||
          session.metadata?.user_email?.toLowerCase() === user.email!.toLowerCase()
        );
        if (userSession && userSession.customer) {
          logStep("Found customer through recent session", { sessionId: userSession.id, customerId: userSession.customer });
          const customer = await stripe.customers.retrieve(userSession.customer as string);
          customers.data = [customer as any];
        }
      }

      // Stripe Search API
      if (customers.data.length === 0 && (stripe as any).customers?.search) {
        try {
          const searchRes = await (stripe as any).customers.search({
            query: `email:'${user.email!.replace(/'/g, "\\'")}'`,
            limit: 10,
          });
          if (searchRes.data?.length) {
            customers.data = [searchRes.data[0]];
            logStep("Found customer via Stripe Search API", { customerId: customers.data[0].id });
          }
        } catch (_e) {
          logStep("Stripe Search API not available or failed");
        }
      }

      // Scan active subscriptions
      if (customers.data.length === 0) {
        const activeSubs = await stripe.subscriptions.list({
          status: "active",
          limit: 100,
          expand: ["data.customer"],
        });
        const matched = activeSubs.data.find((sub: any) => {
          const c = sub.customer as any;
          return c?.email?.toLowerCase?.() === user.email!.toLowerCase();
        });
        if (matched) {
          const cust = matched.customer as any;
          customers.data = [cust];
          logStep("Found customer by scanning active subscriptions", { customerId: cust.id, subscriptionId: matched.id });
        }
      }
    }
    
    if (customers.data.length === 0) {
      logStep("No customer found anywhere");
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_type: null,
        subscription_tier: null,
        subscription_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      
      return new Response(JSON.stringify({ 
        success: true,
        message: "No Stripe customer found",
        subscribed: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active or trialing subscriptions
    const [activeSubscriptions, trialingSubscriptions] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 10 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 10 })
    ]);
    
    const allSubscriptions = [...activeSubscriptions.data, ...trialingSubscriptions.data];
    const subscriptions = { data: allSubscriptions };
    
    let hasActiveSub = subscriptions.data.length > 0;
    let subscriptionType = null;
    let subscriptionTier = null;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      
      // For trialing subscriptions, use trial_end instead of current_period_end
      const endTimestamp = subscription.status === "trialing" && subscription.trial_end 
        ? subscription.trial_end 
        : subscription.current_period_end;
      subscriptionEnd = new Date(endTimestamp * 1000).toISOString();
      subscriptionType = subscription.status === "trialing" ? "trial" : "monthly";
      subscriptionTier = "Premium";
      
      logStep(`${subscription.status === "trialing" ? "Trialing" : "Active"} subscription found`, { 
        subscriptionId: subscription.id, 
        status: subscription.status,
        endDate: subscriptionEnd 
      });
    } else {
      // Check for one-time payments and checkout sessions
      const [oneTimePayments, checkoutSessions] = await Promise.all([
        stripe.paymentIntents.list({ customer: customerId, limit: 50 }),
        stripe.checkout.sessions.list({ customer: customerId, limit: 50 })
      ]);
      
      logStep("Payment history", { 
        paymentIntents: oneTimePayments.data.length,
        checkoutSessions: checkoutSessions.data.length 
      });

      // Check successful payments in last year
      const successfulPayments = oneTimePayments.data.filter(payment => 
        payment.status === 'succeeded' && 
        payment.created > (Date.now() / 1000) - (365 * 24 * 60 * 60) &&
        payment.amount >= 5000 // At least R$ 50,00
      );
      
      // Check completed checkout sessions
      const completedSessions = checkoutSessions.data.filter(session =>
        session.payment_status === 'paid' &&
        session.created > (Date.now() / 1000) - (365 * 24 * 60 * 60) &&
        (session.amount_total ?? 0) >= 5000
      );
      
      logStep("Valid payments found", {
        paymentIntents: successfulPayments.map(p => ({ id: p.id, amount: p.amount, created: new Date(p.created * 1000) })),
        checkoutSessions: completedSessions.map(s => ({ id: s.id, amount: s.amount_total, created: new Date(s.created * 1000) }))
      });

      const latestPayment = successfulPayments[0];
      const latestSession = completedSessions[0];
      
      if (latestPayment || latestSession) {
        hasActiveSub = true;
        subscriptionType = "annual";
        subscriptionTier = "Premium";
        
        const paymentDate = latestPayment ? latestPayment.created : latestSession!.created;
        subscriptionEnd = new Date(paymentDate * 1000 + (365 * 24 * 60 * 60 * 1000)).toISOString();
        
        logStep("Valid payment found", { 
          type: latestPayment ? 'payment_intent' : 'checkout_session',
          id: latestPayment ? latestPayment.id : latestSession!.id,
          endDate: subscriptionEnd 
        });
      }
    }

    // Update database
    await supabaseClient.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      subscribed: hasActiveSub,
      subscription_type: subscriptionType,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    logStep("Updated database", { subscribed: hasActiveSub, subscriptionType, subscriptionTier });
    
    return new Response(JSON.stringify({
      success: true,
      message: "Subscription check completed",
      subscribed: hasActiveSub,
      subscription_type: subscriptionType,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      stripe_customer_id: customerId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});