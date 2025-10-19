import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const description = planType === 'monthly' 
      ? 'BioPeak Pro - Assinatura Mensal'
      : 'BioPeak Pro - Assinatura Anual';

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

    return new Response(
      JSON.stringify({
        status: paymentData.status,
        status_detail: paymentData.status_detail,
        payment_id: paymentData.id,
        amount,
        description,
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
