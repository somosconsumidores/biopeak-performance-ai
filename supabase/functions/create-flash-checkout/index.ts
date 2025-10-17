import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Force rebuild - 2025-01-16
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for enhanced debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FLASH-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Retrieve Stripe secret key from Supabase secrets or environment variables
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    // Detect Stripe mode (live or test) based on the key
    const isLiveMode = stripeKey.startsWith('sk_live_');
    const keySource = Deno.env.get("STRIPE_SECRET_KEY") ? 'secrets' : 'env';
    logStep("Stripe key mode", { mode: isLiveMode ? 'live' : 'test', source: keySource });

    // Initialize Stripe with the retrieved key
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`);
    }

    const user = userData.user;
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Fetch user's phone from profiles table
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('phone')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const userPhone = profile?.phone || null;
    logStep("User phone fetched", { phone: userPhone ? "present" : "not found" });

    // Check if a Stripe customer record exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
      
      // Update customer phone if we have it and it's different
      if (userPhone && customers.data[0].phone !== userPhone) {
        try {
          await stripe.customers.update(customerId, { phone: userPhone });
          logStep("Updated customer phone", { customerId });
        } catch (updateError) {
          logStep("Failed to update customer phone", { error: updateError.message });
        }
      }
    } else {
      logStep("No existing customer found, will create new customer with phone in session");
    }

    // Flash sale price ID
    const flashPriceId = "price_1S85CZI6QbtlS9WtNAIvlP4h";
    logStep("Using flash sale price", { priceId: flashPriceId });

    // Validate the price ID with Stripe
    try {
      const price = await stripe.prices.retrieve(flashPriceId);
      logStep("Price ID validation successful", { priceId: flashPriceId, amount: price.unit_amount });
    } catch (priceError) {
      logStep("Price ID validation failed", { priceId: flashPriceId, error: priceError.message });
      throw new Error(`Invalid price ID: ${flashPriceId}`);
    }

    // Create checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      ...(customerId ? { customer_update: { address: 'auto', name: 'auto' } } : {}),
      phone_number_collection: { enabled: !!userPhone },
      ...(userPhone && !customerId ? { customer_data: { phone: userPhone } } : {}),
      line_items: [
        {
          price: flashPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/paywall2?success=true`,
      cancel_url: `${req.headers.get("origin")}/paywall2?canceled=true`,
      billing_address_collection: 'required',
      metadata: {
        user_id: user.id,
        purchase_type: 'subscription',
        plan: 'flash',
        ...(userPhone && { phone: userPhone })
      },
    });

    logStep("Checkout session created successfully", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-flash-checkout", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});