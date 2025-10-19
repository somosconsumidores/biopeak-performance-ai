import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Get JWT token to identify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { planType, payerEmail, cardData } = await req.json();
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('Mercado Pago access token não configurado');
    }

    console.log('[MP Backend] Processing payment for plan:', planType);

    // Step 1: Tokenize the card using Mercado Pago API
    console.log('[MP Backend] Tokenizing card...');
    const tokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        card_number: cardData.cardNumber,
        cardholder: {
          name: cardData.cardholderName,
          identification: {
            type: cardData.identificationType,
            number: cardData.identificationNumber,
          },
        },
        expiration_month: cardData.cardExpirationMonth,
        expiration_year: `20${cardData.cardExpirationYear}`, // Convert YY to YYYY
        security_code: cardData.securityCode,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[MP Backend] Tokenization error:', errorData);
      throw new Error(errorData.message || 'Erro ao tokenizar cartão');
    }

    const tokenData = await tokenResponse.json();
    console.log('[MP Backend] Card tokenized successfully:', tokenData.id);

    // Step 2: Create payment with the token
    const planPrices = {
      monthly: 12.90,
      yearly: 154.80,
    };
    
    const amount = planPrices[planType as keyof typeof planPrices] || 12.90;
    const amountCents = Math.round(amount * 100);
    const description = planType === 'monthly' 
      ? 'BioPeak Pro - Assinatura Mensal'
      : 'BioPeak Pro - Assinatura Anual';

    // Insert initial payment record with pending status
    console.log('[MP Backend] Creating payment record...');
    const { data: paymentRecord, error: insertError } = await supabase
      .from('mercadopago_payments')
      .insert({
        user_id: user.id,
        status: 'pending',
        plan_type: planType,
        amount_cents: amountCents,
        currency: 'BRL',
        payer_email: payerEmail
      })
      .select()
      .single();

    if (insertError) {
      console.error('[MP Backend] Error creating payment record:', insertError);
      throw new Error('Failed to create payment record');
    }

    console.log('[MP Backend] Payment record created:', paymentRecord.id);
    console.log('[MP Backend] Creating payment...');
    const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': `${payerEmail}-${Date.now()}`, // Prevent duplicate payments
      },
      body: JSON.stringify({
        transaction_amount: amount,
        token: tokenData.id,
        description,
        installments: 1,
        payment_method_id: tokenData.payment_method_id,
        payer: {
          email: payerEmail,
          identification: {
            type: cardData.identificationType,
            number: cardData.identificationNumber,
          },
        },
      }),
    });

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      console.error('[MP Backend] Payment error:', errorData);
      throw new Error(errorData.message || 'Erro ao processar pagamento');
    }

    const paymentData = await paymentResponse.json();
    console.log('[MP Backend] Payment processed:', paymentData.status);

    // Update payment record with MP payment_id and status
    const { error: updateError } = await supabase
      .from('mercadopago_payments')
      .update({
        payment_id: paymentData.id.toString(),
        status: paymentData.status,
        payment_method: paymentData.payment_method_id,
        payment_type_id: paymentData.payment_type_id,
        approved_at: paymentData.status === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentRecord.id);

    if (updateError) {
      console.error('[MP Backend] Error updating payment record:', updateError);
    }

    return new Response(
      JSON.stringify({
        status: paymentData.status,
        status_detail: paymentData.status_detail,
        payment_id: paymentData.id,
        amount,
        description,
        record_id: paymentRecord.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[MP Backend] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erro ao processar pagamento',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
