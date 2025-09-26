// Updated: Force redeploy to check if function appears in Supabase dashboard
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for enhanced debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-PAYMENT-HISTORY] ${step}${detailsStr}`);
};

interface PaymentRecord {
  stripe_payment_id: string;
  tipo_pagamento: 'subscription' | 'one_time';
  valor_centavos: number;
  moeda: string;
  status: string;
  descricao: string;
  data_pagamento: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  metadata: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get Stripe secret key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      logStep("No Stripe customer found for this user");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No Stripe customer found for this user",
        synced_payments: 0,
        new_payments: 0,
        updated_payments: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get existing payment records from database
    const { data: existingPayments, error: dbError } = await supabaseClient
      .from('faturamento')
      .select('stripe_payment_id')
      .eq('user_id', user.id);

    if (dbError) throw new Error(`Database error: ${dbError.message}`);
    
    const existingPaymentIds = new Set(existingPayments?.map(p => p.stripe_payment_id) || []);
    logStep("Existing payments in DB", { count: existingPaymentIds.size });

    const paymentsToInsert: PaymentRecord[] = [];
    let totalProcessed = 0;
    let newPayments = 0;

    // 1. Fetch subscription payments (invoices)
    logStep("Fetching subscription invoices");
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: 'paid',
      limit: 100, // Adjust as needed
    });

    for (const invoice of invoices.data) {
      totalProcessed++;
      
      if (!existingPaymentIds.has(invoice.id)) {
        const periodStart = invoice.period_start 
          ? new Date(invoice.period_start * 1000).toISOString().split('T')[0]
          : null;
        const periodEnd = invoice.period_end 
          ? new Date(invoice.period_end * 1000).toISOString().split('T')[0] 
          : null;

        paymentsToInsert.push({
          stripe_payment_id: invoice.id,
          tipo_pagamento: 'subscription',
          valor_centavos: invoice.amount_paid,
          moeda: invoice.currency.toUpperCase(),
          status: 'succeeded',
          descricao: invoice.description || `Subscription invoice #${invoice.number}`,
          data_pagamento: new Date(invoice.created * 1000).toISOString(),
          periodo_inicio: periodStart,
          periodo_fim: periodEnd,
          metadata: {
            invoice_number: invoice.number,
            subscription_id: invoice.subscription,
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf
          }
        });
        newPayments++;
      }
    }

    // 2. Fetch one-time payments (payment intents)
    logStep("Fetching payment intents");
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 100, // Adjust as needed
    });

    for (const paymentIntent of paymentIntents.data) {
      totalProcessed++;
      
      if (paymentIntent.status === 'succeeded' && !existingPaymentIds.has(paymentIntent.id)) {
        paymentsToInsert.push({
          stripe_payment_id: paymentIntent.id,
          tipo_pagamento: 'one_time',
          valor_centavos: paymentIntent.amount,
          moeda: paymentIntent.currency.toUpperCase(),
          status: paymentIntent.status,
          descricao: paymentIntent.description || 'One-time payment',
          data_pagamento: new Date(paymentIntent.created * 1000).toISOString(),
          metadata: {
            payment_method: paymentIntent.payment_method,
            receipt_email: paymentIntent.receipt_email
          }
        });
        newPayments++;
      }
    }

    logStep("Payments to insert", { count: paymentsToInsert.length });

    // Insert new payments into database
    let insertedCount = 0;
    if (paymentsToInsert.length > 0) {
      const paymentsWithUserId = paymentsToInsert.map(payment => ({
        ...payment,
        user_id: user.id,
        stripe_customer_id: customerId
      }));

      const { error: insertError } = await supabaseClient
        .from('faturamento')
        .insert(paymentsWithUserId);

      if (insertError) {
        logStep("Insert error", { error: insertError });
        throw new Error(`Failed to insert payments: ${insertError.message}`);
      }

      insertedCount = paymentsToInsert.length;
      logStep("Payments inserted successfully", { count: insertedCount });
    }

    // Calculate totals for response
    const totalValue = paymentsToInsert.reduce((sum, payment) => sum + payment.valor_centavos, 0);

    const response = {
      success: true,
      user_id: user.id,
      stripe_customer_id: customerId,
      synced_payments: totalProcessed,
      new_payments: insertedCount,
      updated_payments: 0, // For now, we're only inserting new payments
      total_value_centavos: totalValue,
      summary: {
        subscription_payments: paymentsToInsert.filter(p => p.tipo_pagamento === 'subscription').length,
        one_time_payments: paymentsToInsert.filter(p => p.tipo_pagamento === 'one_time').length
      }
    };

    logStep("Sync completed successfully", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in sync-payment-history", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});