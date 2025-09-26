// Updated: Force redeploy with simplified dependencies
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey || !stripeKey) {
      throw new Error("Missing required environment variables");
    }
    logStep("Environment variables verified");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    
    // Get user from Supabase auth using direct API call
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseServiceKey,
      }
    });
    
    if (!userResponse.ok) {
      throw new Error("Authentication failed");
    }
    
    const user = await userResponse.json();
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Find Stripe customer by email using direct API call
    const customersResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`, {
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });
    
    if (!customersResponse.ok) {
      throw new Error("Failed to fetch Stripe customers");
    }
    
    const customersData = await customersResponse.json();
    if (customersData.data.length === 0) {
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

    const customerId = customersData.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get existing payment records from database using direct API call
    const existingPaymentsResponse = await fetch(`${supabaseUrl}/rest/v1/faturamento?user_id=eq.${user.id}&select=stripe_payment_id`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
      }
    });
    
    if (!existingPaymentsResponse.ok) {
      throw new Error("Failed to fetch existing payments");
    }
    
    const existingPayments = await existingPaymentsResponse.json();
    const existingPaymentIds = new Set(existingPayments.map((p: any) => p.stripe_payment_id) || []);
    logStep("Existing payments in DB", { count: existingPaymentIds.size });

    const paymentsToInsert: PaymentRecord[] = [];
    let totalProcessed = 0;
    let newPayments = 0;

    // 1. Fetch subscription payments (invoices) using direct API call
    logStep("Fetching subscription invoices");
    const invoicesResponse = await fetch(`https://api.stripe.com/v1/invoices?customer=${customerId}&status=paid&limit=100`, {
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });
    
    if (!invoicesResponse.ok) {
      throw new Error("Failed to fetch invoices");
    }
    
    const invoicesData = await invoicesResponse.json();

    for (const invoice of invoicesData.data) {
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

    // 2. Fetch one-time payments (payment intents) using direct API call
    logStep("Fetching payment intents");
    const paymentIntentsResponse = await fetch(`https://api.stripe.com/v1/payment_intents?customer=${customerId}&limit=100`, {
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });
    
    if (!paymentIntentsResponse.ok) {
      throw new Error("Failed to fetch payment intents");
    }
    
    const paymentIntentsData = await paymentIntentsResponse.json();

    for (const paymentIntent of paymentIntentsData.data) {
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

    // Insert new payments into database using direct API call
    let insertedCount = 0;
    if (paymentsToInsert.length > 0) {
      const paymentsWithUserId = paymentsToInsert.map(payment => ({
        ...payment,
        user_id: user.id,
        stripe_customer_id: customerId
      }));

      const insertResponse = await fetch(`${supabaseUrl}/rest/v1/faturamento`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(paymentsWithUserId)
      });

      if (!insertResponse.ok) {
        const errorData = await insertResponse.text();
        logStep("Insert error", { error: errorData });
        throw new Error(`Failed to insert payments: ${errorData}`);
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