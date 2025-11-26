import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MINUTES = 5;

const logMetric = (metric: string, value: number, tags?: Record<string, string>) => {
  console.log(JSON.stringify({
    type: 'metric',
    metric,
    value,
    tags,
    timestamp: Date.now()
  }));
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VALIDATE-SUBSCRIPTION-UNIFIED] ${step}${detailsStr}`);
};

serve(async (req) => {
  const startTime = Date.now();
  
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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // ===== STEP 1: CHECK DATABASE CACHE (TARGET: < 100ms) =====
    const cacheCheckStart = Date.now();
    const { data: subscriber } = await supabaseClient
      .from('subscribers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const cacheCheckDuration = Date.now() - cacheCheckStart;
    logMetric('cache_check_duration_ms', cacheCheckDuration, { user_id: user.id });

    // Check if cache is valid (updated within last 5 minutes AND not expired)
    if (subscriber?.updated_at) {
      const cacheAge = Date.now() - new Date(subscriber.updated_at).getTime();
      const cacheAgeMinutes = cacheAge / (1000 * 60);
      
      if (cacheAgeMinutes < CACHE_TTL_MINUTES) {
        // Cache is fresh, check if subscription is valid
        if (subscriber.subscribed && subscriber.subscription_end) {
          const endDate = new Date(subscriber.subscription_end);
          const now = new Date();
          
          if (endDate > now) {
            logStep("✅ CACHE HIT - Active subscription", { 
              cache_age_minutes: cacheAgeMinutes.toFixed(2),
              subscription_end: subscriber.subscription_end 
            });
            
            logMetric('subscription_check_duration_ms', Date.now() - startTime, {
              user_id: user.id,
              source: 'cache_hit',
              result: 'subscribed'
            });
            
            return new Response(JSON.stringify({
              subscribed: true,
              subscription_type: subscriber.subscription_type,
              subscription_tier: subscriber.subscription_tier,
              subscription_end: subscriber.subscription_end,
              source: 'cache',
              cache_age_minutes: cacheAgeMinutes.toFixed(2)
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        } else if (!subscriber.subscribed && cacheAgeMinutes < CACHE_TTL_MINUTES) {
          // Cache says not subscribed and it's fresh
          logStep("✅ CACHE HIT - Not subscribed", { cache_age_minutes: cacheAgeMinutes.toFixed(2) });
          
          logMetric('subscription_check_duration_ms', Date.now() - startTime, {
            user_id: user.id,
            source: 'cache_hit',
            result: 'not_subscribed'
          });
          
          return new Response(JSON.stringify({
            subscribed: false,
            source: 'cache',
            cache_age_minutes: cacheAgeMinutes.toFixed(2)
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      
      logStep("Cache expired or invalid", { cache_age_minutes: cacheAgeMinutes.toFixed(2) });
    } else {
      logStep("No cache found");
    }

    // ===== STEP 2: FULL STRIPE VERIFICATION (TARGET: < 500ms) =====
    const stripeCheckStart = Date.now();
    logStep("🔄 CACHE MISS - Performing full Stripe verification");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Find customer by email
    let customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found, marking as not subscribed");
      
      // Update database
      await supabaseClient.from("subscribers").upsert({
        user_id: user.id,
        email: user.email,
        stripe_customer_id: null,
        subscribed: false,
        subscription_type: null,
        subscription_tier: null,
        subscription_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      
      logMetric('subscription_check_duration_ms', Date.now() - startTime, {
        user_id: user.id,
        source: 'stripe_verification',
        result: 'not_subscribed'
      });
      
      return new Response(JSON.stringify({ subscribed: false, source: 'stripe' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active or trialing subscriptions
    const [activeSubscriptions, trialingSubscriptions] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 })
    ]);
    
    const subscriptions = activeSubscriptions.data.length > 0 
      ? activeSubscriptions 
      : trialingSubscriptions;
    
    const stripeCheckDuration = Date.now() - stripeCheckStart;
    logMetric('stripe_check_duration_ms', stripeCheckDuration, { user_id: user.id });

    let hasActiveSub = false;
    let subscriptionType = null;
    let subscriptionTier = null;
    let subscriptionEnd = null;

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      hasActiveSub = true;
      
      // For trialing subscriptions, use trial_end instead of current_period_end
      const endTimestamp = sub.status === "trialing" && sub.trial_end 
        ? sub.trial_end 
        : sub.current_period_end;
      subscriptionEnd = new Date(endTimestamp * 1000).toISOString();
      subscriptionType = sub.status === "trialing" ? "trial" : "stripe";
      subscriptionTier = "premium";
      
      logStep(`${sub.status === "trialing" ? "Trialing" : "Active"} Stripe subscription found`, { 
        subscriptionId: sub.id, 
        status: sub.status,
        endDate: subscriptionEnd 
      });
    }

    // Update database with fresh data
    await supabaseClient.from("subscribers").upsert({
      user_id: user.id,
      email: user.email,
      stripe_customer_id: customerId,
      subscribed: hasActiveSub,
      subscription_type: subscriptionType,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    logStep("Database updated with fresh Stripe data");
    
    logMetric('subscription_check_duration_ms', Date.now() - startTime, {
      user_id: user.id,
      source: 'stripe_verification',
      result: hasActiveSub ? 'subscribed' : 'not_subscribed'
    });

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_type: subscriptionType,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      source: 'stripe'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    logMetric('subscription_check_duration_ms', Date.now() - startTime, {
      source: 'error',
      error: errorMessage
    });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
