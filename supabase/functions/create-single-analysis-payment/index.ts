import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    const body = await req.json();
    const activityId = body.activityId;
    const activitySource = body.activitySource || 'strava';

    if (!activityId) {
      throw new Error("Activity ID is required");
    }

    console.log('Creating payment for single AI analysis:', { userId: user.id, activityId, activitySource });

    // Check if already purchased
    const { data: existingPurchase } = await supabaseAdmin
      .from('ai_analysis_purchases')
      .select('*')
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingPurchase) {
      return new Response(
        JSON.stringify({ 
          error: 'Análise já comprada',
          alreadyPurchased: true 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: "price_1SDDHdI6QbtlS9WtbSvwNClg",
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/workouts?payment=success&activity=${activityId}`,
      cancel_url: `${req.headers.get("origin")}/workouts?payment=canceled`,
      metadata: {
        user_id: user.id,
        activity_id: activityId,
        activity_source: activitySource,
        purchase_type: 'ai_analysis'
      }
    });

    // Record pending purchase
    const { error: insertError } = await supabaseAdmin
      .from('ai_analysis_purchases')
      .insert({
        user_id: user.id,
        activity_id: activityId,
        activity_source: activitySource,
        stripe_payment_intent_id: session.id,
        amount_cents: 499,
        status: 'pending'
      });

    if (insertError) {
      console.error('Error recording purchase:', insertError);
      throw insertError;
    }

    console.log('Payment session created successfully:', session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});