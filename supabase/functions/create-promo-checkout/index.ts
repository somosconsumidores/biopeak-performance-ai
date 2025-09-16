import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Get request body
    const { campaign, promoPrice, returnUrl } = await req.json();

    console.log('Creating promo checkout:', { campaign, promoPrice, userId: user.id });

    // Get Stripe secret key from secrets or environment
    let stripeSecretKey = null;
    
    try {
      const { data: secretData } = await supabaseServiceClient
        .from('vault')
        .select('secret')
        .eq('name', 'STRIPE_SECRET_KEY')
        .single();
      
      if (secretData?.secret) {
        stripeSecretKey = secretData.secret;
      }
    } catch (error) {
      console.log('No Stripe secret found in vault, checking environment');
    }

    if (!stripeSecretKey) {
      stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    }

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    // Detect Stripe mode
    const isLiveMode = stripeSecretKey.startsWith('sk_live_');
    console.log('Stripe mode:', isLiveMode ? 'live' : 'test');

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Create or retrieve Stripe customer
    let customer;
    try {
      const customers = await stripe.customers.list({
        email: user.email!,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            supabase_user_id: user.id,
            campaign: campaign || 'promo'
          },
        });
      }
    } catch (error) {
      console.error('Error creating/retrieving customer:', error);
      throw error;
    }

    // Determine promotional price ID based on campaign and price
    let promoPriceId = null;
    
    // Check app_settings for promotional price IDs
    const priceKey = `STRIPE_${campaign?.toUpperCase()}_PRICE_ID`;
    const { data: appSettings } = await supabaseServiceClient
      .from('app_settings')
      .select('value')
      .eq('key', priceKey)
      .single();
    
    if (appSettings?.value) {
      promoPriceId = appSettings.value;
    } else {
      // Fallback to environment variable
      promoPriceId = Deno.env.get(priceKey);
    }

    // If no specific promo price found, try to create one or use fallback
    if (!promoPriceId) {
      console.log('No promotional price ID found, using fallback logic');
      
      // For now, we'll use the regular monthly price and apply a coupon
      // In production, you should create specific promotional prices in Stripe
      const monthlyPriceKey = isLiveMode ? 'STRIPE_MONTHLY_PRICE_ID' : 'STRIPE_MONTHLY_PRICE_ID_TEST';
      
      const { data: monthlySettings } = await supabaseServiceClient
        .from('app_settings')
        .select('value')
        .eq('key', monthlyPriceKey)
        .single();
      
      promoPriceId = monthlySettings?.value || Deno.env.get('STRIPE_MONTHLY_PRICE_ID');
    }

    if (!promoPriceId) {
      throw new Error('No promotional price ID configured');
    }

    console.log('Using promotional price ID:', promoPriceId);

    // Create checkout session with promotional pricing
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: promoPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${returnUrl || Deno.env.get('SITE_URL') || 'https://app.biopeak.com.br'}/dashboard?success=true&campaign=${campaign}`,
      cancel_url: `${returnUrl || Deno.env.get('SITE_URL') || 'https://app.biopeak.com.br'}/promo?campaign=${campaign}`,
      metadata: {
        user_id: user.id,
        campaign: campaign || 'promo',
        promo_price: promoPrice?.toString() || 'promotional'
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          campaign: campaign || 'promo'
        }
      },
      allow_promotion_codes: false, // Disable promotion codes since we're using promotional pricing
    });

    console.log('Promo checkout session created:', session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-promo-checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});