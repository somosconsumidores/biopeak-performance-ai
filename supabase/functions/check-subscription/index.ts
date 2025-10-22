import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // ===== PRIORITY 1: CHECK DATABASE CACHE FIRST (< 100ms) =====
    const { data: subscriber } = await supabaseClient
      .from('subscribers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // If found valid subscription in database, return immediately
    if (subscriber?.subscribed && subscriber?.subscription_end) {
      const endDate = new Date(subscriber.subscription_end);
      const now = new Date();
      
      if (endDate > now) {
        logStep("Database cache hit - returning active subscription", { 
          subscription_end: subscriber.subscription_end,
          subscription_tier: subscriber.subscription_tier,
          subscription_type: subscriber.subscription_type 
        });
        
        return new Response(JSON.stringify({
          subscribed: true,
          subscription_type: subscriber.subscription_type,
          subscription_tier: subscriber.subscription_tier,
          subscription_end: subscriber.subscription_end,
          source: 'database_cache'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        logStep("Database cache expired, proceeding to Stripe verification", {
          expired_on: subscriber.subscription_end
        });
      }
    } else {
      logStep("No valid database cache found, proceeding to Stripe verification");
    }

    // ===== PRIORITY 2: FULL STRIPE VERIFICATION (only if cache miss/expired) =====
    // Get Stripe secret key from Supabase secrets (primary) or env (fallback)
    let stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    let keySource = "secrets";
    
    if (!stripeKey) {
      stripeKey = Deno.env.get("STRIPE_SECRET_KEY_FALLBACK") || "";
      keySource = "env-fallback";
    }
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured in Supabase secrets or environment");
    }

    // Detect Stripe mode (test/live) from key prefix
    const isLiveMode = stripeKey.startsWith("sk_live_");
    const isTestMode = stripeKey.startsWith("sk_test_");
    const stripeMode = isLiveMode ? "live" : isTestMode ? "test" : "unknown";
    
    logStep("Stripe key verified - proceeding to full check", { mode: stripeMode, source: keySource });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // First try to find customer by email
    let customers = await stripe.customers.list({ email: user.email, limit: 10 });
    logStep("Customer search by email", { email: user.email, foundCount: customers.data.length });
    
    // If no customer found by email, try searching by metadata or other methods
    if (customers.data.length === 0) {
      // Try different email variations (lowercase, trim, etc.)
      const emailVariations = [
        user.email.toLowerCase().trim(),
        user.email.trim(),
        user.email.toLowerCase()
      ];
      
      for (const emailVar of emailVariations) {
        if (emailVar !== user.email) {
          const altCustomers = await stripe.customers.list({ email: emailVar, limit: 5 });
          if (altCustomers.data.length > 0) {
            customers = altCustomers;
            logStep("Found customer with email variation", { originalEmail: user.email, foundEmail: emailVar });
            break;
          }
        }
      }
    }
    
    // If still no customer found, broaden search (sessions, search API, active subs)
    if (customers.data.length === 0) {
      logStep("No customer found by email, performing broader search");

      // 1) Recent checkout sessions (larger window)
      const recentSessions = await stripe.checkout.sessions.list({ limit: 100 });
      const userSession = recentSessions.data.find((session) =>
        (session.customer_email?.toLowerCase() === user.email.toLowerCase()) ||
        (session.metadata?.user_email?.toLowerCase() === user.email.toLowerCase())
      );

      if (userSession?.customer) {
        logStep("Found customer through recent session", { sessionId: userSession.id, customerId: userSession.customer });
        const customer = await stripe.customers.retrieve(userSession.customer as string);
        customers.data = [customer as any];
      }

      // 2) Stripe Search API for customers by email
      if (customers.data.length === 0 && (stripe as any).customers?.search) {
        try {
          const searchRes = await (stripe as any).customers.search({
            query: `email:'${user.email.replace(/'/g, "\\'")}'`,
            limit: 10,
          });
          if (searchRes.data?.length) {
            customers.data = [searchRes.data[0]];
            logStep("Found customer via Stripe Search API", { customerId: customers.data[0].id });
          }
        } catch (e) {
          logStep("Stripe Search API not available or failed");
        }
      }

      // 3) Scan active subscriptions and match by customer email
      if (customers.data.length === 0) {
        const activeSubs = await stripe.subscriptions.list({
          status: "active",
          limit: 100,
          expand: ["data.customer"],
        });
        const matched = activeSubs.data.find((sub: any) => {
          const c = sub.customer as any;
          return c?.email?.toLowerCase?.() === user.email.toLowerCase();
        });
        if (matched) {
          const cust = matched.customer as any;
          customers.data = [cust];
          logStep("Found customer by scanning active subscriptions", { customerId: cust.id, subscriptionId: matched.id });
        }
      }

      if (customers.data.length === 0) {
        // Antes de marcar como não assinante, tente preservar estado em cache ativo
        const { data: cachedSub } = await supabaseClient
          .from('subscribers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const isCachedActive = !!(cachedSub?.subscribed && cachedSub?.subscription_end && new Date(cachedSub.subscription_end) > new Date());

        if (isCachedActive) {
          logStep("No customer found, but cached active subscription exists; returning cached and skipping DB update", {
            subscription_end: cachedSub.subscription_end,
          });
          return new Response(
            JSON.stringify({
              subscribed: true,
              subscription_type: cachedSub.subscription_type,
              subscription_tier: cachedSub.subscription_tier,
              subscription_end: cachedSub.subscription_end,
              cached: true,
              note: 'Stripe lookup returned no customer; using cached status',
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }

        logStep("No customer found anywhere, updating unsubscribed state");
        await supabaseClient.from("subscribers").upsert(
          {
            email: user.email,
            user_id: user.id,
            stripe_customer_id: null,
            subscribed: false,
            subscription_type: null,
            subscription_tier: null,
            subscription_end: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );
        return new Response(JSON.stringify({ subscribed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for subscriptions (all statuses to detect past_due, unpaid, etc.)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });
    
    let hasActiveSub = false;
    let subscriptionType = null;
    let subscriptionTier = null;
    let subscriptionEnd = null;

    // Validate subscription status
    for (const sub of subscriptions.data) {
      logStep("Checking subscription", { id: sub.id, status: sub.status });
      
      // Considerar tanto 'active' quanto 'trialing' como válidos
      if (sub.status === "active" || sub.status === "trialing") {
        hasActiveSub = true;
        
        // Usar trial_end para trials, current_period_end para ativos
        const endTimestamp = sub.status === "trialing" && sub.trial_end 
          ? sub.trial_end 
          : sub.current_period_end;
          
        subscriptionEnd = new Date(endTimestamp * 1000).toISOString();
        
        // Identificar tipo de assinatura
        subscriptionType = sub.status === "trialing" ? "trial" : "monthly";
        subscriptionTier = "Premium";
        
        logStep(`${sub.status === "trialing" ? "Trial" : "Active"} subscription found`, { 
          subscriptionId: sub.id, 
          endDate: subscriptionEnd,
          status: sub.status 
        });
        break; // Use first active/trialing subscription
      } else if (["past_due", "unpaid", "incomplete", "canceled"].includes(sub.status)) {
        logStep("Subscription with problematic status detected", {
          subscriptionId: sub.id,
          status: sub.status
        });
        hasActiveSub = false;
        // Don't break - continue to check if there's an active one
      }
    }

    if (!hasActiveSub) {
      logStep("No active subscriptions, checking for one-time payments");
      
      // Check for one-time payments in the last year (annual)
      const oneTimePayments = await stripe.paymentIntents.list({
        customer: customerId,
        limit: 20,
      });
      
      logStep("Found payment intents", { count: oneTimePayments.data.length });
      
      // Check for any successful payment that could be annual
      const successfulPayments = oneTimePayments.data.filter(payment => 
        payment.status === 'succeeded' && 
        payment.created > (Date.now() / 1000) - (365 * 24 * 60 * 60) && // Within last year
        payment.amount >= 10000 // At least R$ 100,00 (assuming annual payment is significant)
      );
      
      logStep("Successful payments in last year", { 
        count: successfulPayments.length,
        payments: successfulPayments.map(p => ({ id: p.id, amount: p.amount, created: p.created }))
      });
      
      // Also check checkout sessions for completed payments
      const checkoutSessions = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 20,
      });
      
      const completedSessions = checkoutSessions.data.filter(session =>
        session.payment_status === 'paid' &&
        session.created > (Date.now() / 1000) - (365 * 24 * 60 * 60) &&
        (session.amount_total ?? 0) >= 10000 // At least R$ 100,00
      );
      
      logStep("Completed checkout sessions", { 
        count: completedSessions.length,
        sessions: completedSessions.map(s => ({ id: s.id, amount: s.amount_total, created: s.created }))
      });

      // If we found any successful payment or completed session, consider it valid
      const latestPayment = successfulPayments[0];
      const latestSession = completedSessions[0];
      
      if (latestPayment || latestSession) {
        hasActiveSub = true;
        subscriptionType = "annual";
        subscriptionTier = "Premium";
        
        const paymentDate = latestPayment ? latestPayment.created : latestSession!.created;
        subscriptionEnd = new Date(paymentDate * 1000 + (365 * 24 * 60 * 60 * 1000)).toISOString();
        
        logStep("Valid annual payment found", { 
          type: latestPayment ? 'payment_intent' : 'checkout_session',
          id: latestPayment ? latestPayment.id : latestSession!.id,
          endDate: subscriptionEnd 
        });
      } else {
        logStep("No valid payments found");
      }
    }

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

    logStep("Updated database with subscription info", { subscribed: hasActiveSub, subscriptionType, subscriptionTier });
    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_type: subscriptionType,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    
    // Don't zero out subscription on authentication/technical errors
    // These are likely temporary issues that shouldn't affect subscription status
    const isAuthError = errorMessage.includes('Authentication error') || 
                       errorMessage.includes('Session from session_id claim') ||
                       errorMessage.includes('invalid authorization') ||
                       errorMessage.includes('User not authenticated');
    
    const isNetworkError = errorMessage.includes('network') || 
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('connection');
    
    if (isAuthError || isNetworkError) {
      logStep("Temporary error detected, preserving subscription state", { errorType: isAuthError ? 'auth' : 'network' });
      
      // Try to return cached subscription data without updating database
      try {
        const authHeader = req.headers.get("Authorization");
        if (authHeader) {
          const token = authHeader.replace("Bearer ", "");
          const { data: userData } = await supabaseClient.auth.getUser(token);
          if (userData.user) {
            const { data: cachedSub } = await supabaseClient
              .from('subscribers')
              .select('*')
              .eq('user_id', userData.user.id)
              .maybeSingle();
            
            if (cachedSub) {
              logStep("Returning cached subscription data during temporary error");
              return new Response(JSON.stringify({
                subscribed: cachedSub.subscribed,
                subscription_type: cachedSub.subscription_type,
                subscription_tier: cachedSub.subscription_tier,
                subscription_end: cachedSub.subscription_end,
                cached: true // Indicate this is cached data
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
          }
        }
      } catch (cacheError) {
        logStep("Failed to retrieve cached data", { error: cacheError.message });
      }
      
      // If can't get cached data, return unsubscribed but don't update database
      return new Response(JSON.stringify({ 
        subscribed: false, 
        error: "Temporary error - subscription status may be outdated",
        temporary: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // For other errors, return error response but don't update database
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});