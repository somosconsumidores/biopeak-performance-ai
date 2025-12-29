// RevenueCat Webhook Handler - Updated to record payments in faturamento table
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhook = await req.json();
    console.log('🔔 RevenueCat webhook received:', JSON.stringify(webhook, null, 2));

    const { event } = webhook;
    const app_user_id = event?.app_user_id;

    console.log('📱 Processing for app_user_id:', app_user_id);
    console.log('🎯 Event type:', event?.type);

    if (!app_user_id) {
      console.log('❌ No app_user_id found in webhook');
      return new Response(JSON.stringify({ success: true, message: 'No user ID found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Mapear eventos RevenueCat para status de assinatura
    let subscribed = false;
    let subscription_tier = null;
    let subscription_end = null;
    let shouldRecordPayment = false;
    let paymentType = '';

    switch (event.type) {
      case 'INITIAL_PURCHASE':
        subscribed = true;
        subscription_tier = 'premium';
        shouldRecordPayment = true;
        paymentType = 'revenuecat_initial';
        if (event.expiration_at_ms) {
          subscription_end = new Date(event.expiration_at_ms).toISOString();
        }
        console.log('✅ Setting subscription to active (initial purchase)');
        break;

      case 'RENEWAL':
        subscribed = true;
        subscription_tier = 'premium';
        shouldRecordPayment = true;
        paymentType = 'revenuecat_renewal';
        if (event.expiration_at_ms) {
          subscription_end = new Date(event.expiration_at_ms).toISOString();
        }
        console.log('✅ Setting subscription to active (renewal)');
        break;

      case 'UNCANCELLATION':
        subscribed = true;
        subscription_tier = 'premium';
        if (event.expiration_at_ms) {
          subscription_end = new Date(event.expiration_at_ms).toISOString();
        }
        console.log('✅ Setting subscription to active (uncancellation)');
        break;

      case 'CANCELLATION':
      case 'EXPIRATION':
        subscribed = false;
        subscription_tier = null;
        subscription_end = null;
        console.log('❌ Setting subscription to inactive');
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
        return new Response(JSON.stringify({ success: true, message: `Unhandled event: ${event.type}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
    }

    console.log('💾 Attempting to update subscriber with data:', {
      user_id: app_user_id,
      subscribed,
      subscription_tier,
      subscription_end
    });

    // Verificar se o subscriber já existe
    const { data: existingSubscriber } = await supabase
      .from('subscribers')
      .select('id')
      .eq('user_id', app_user_id)
      .single();

    let data, error;

    if (existingSubscriber) {
      // Atualizar subscriber existente
      console.log('📝 Updating existing subscriber');
      const result = await supabase
        .from('subscribers')
        .update({
          subscribed,
          subscription_tier,
          subscription_end,
          subscription_type: 'revenuecat',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', app_user_id)
        .select();
      data = result.data;
      error = result.error;
    } else {
      // Criar novo subscriber - buscar email do usuário primeiro
      console.log('➕ Creating new subscriber');
      
      // Buscar email do usuário na tabela auth.users
      const { data: userData, error: userError } = await supabase
        .auth.admin.getUserById(app_user_id);
      
      if (userError) {
        console.error('❌ Error fetching user data:', userError);
        throw new Error(`Could not fetch user data for user_id: ${app_user_id}`);
      }
      
      const userEmail = userData?.user?.email;
      if (!userEmail) {
        console.error('❌ User email not found for user_id:', app_user_id);
        throw new Error(`User email not found for user_id: ${app_user_id}`);
      }
      
      console.log('📧 Found user email:', userEmail);
      
      const result = await supabase
        .from('subscribers')
        .insert({
          user_id: app_user_id,
          email: userEmail,
          subscribed,
          subscription_tier,
          subscription_end,
          subscription_type: 'revenuecat',
          updated_at: new Date().toISOString()
        })
        .select();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }

    console.log('✅ Database update successful:', data);

    // Registrar pagamento na tabela faturamento para INITIAL_PURCHASE e RENEWAL
    if (shouldRecordPayment) {
      const transactionId = event.transaction_id || event.id || `rc_${Date.now()}`;
      
      // RevenueCat pode enviar preço em diferentes campos
      // Fallback para R$12,90 (1290 centavos) que é o preço mensal padrão
      let priceInCents = 1290; // Default: R$12,90 mensal
      
      if (event.price_in_purchased_currency && event.price_in_purchased_currency > 0) {
        priceInCents = Math.round(event.price_in_purchased_currency * 100);
      } else if (event.price && event.price > 0) {
        priceInCents = Math.round(event.price * 100);
      } else if (event.product_id) {
        // Determinar preço baseado no product_id
        const productId = event.product_id.toLowerCase();
        if (productId.includes('annual') || productId.includes('yearly') || productId.includes('anual')) {
          priceInCents = 9990; // R$99,90 anual
        } else {
          priceInCents = 1290; // R$12,90 mensal
        }
      }
      
      const currency = event.currency || 'BRL';
      const purchasedAt = event.purchased_at_ms 
        ? new Date(event.purchased_at_ms).toISOString()
        : new Date().toISOString();

      console.log('💰 Recording payment in faturamento:', {
        transaction_id: transactionId,
        price_cents: priceInCents,
        currency,
        payment_type: paymentType,
        product_id: event.product_id
      });

      // Verificar se já existe registro com este transaction_id para evitar duplicatas
      const { data: existingPayment } = await supabase
        .from('faturamento')
        .select('id')
        .eq('stripe_payment_id', transactionId)
        .single();

      if (!existingPayment) {
        const { error: faturamentoError } = await supabase
          .from('faturamento')
          .insert({
            user_id: app_user_id,
            stripe_customer_id: `revenuecat_${app_user_id}`,
            stripe_payment_id: transactionId,
            valor_centavos: priceInCents,
            moeda: currency,
            status: 'completed',
            tipo_pagamento: paymentType,
            data_pagamento: purchasedAt,
            descricao: `RevenueCat ${event.product_id || 'subscription'}`,
            periodo_inicio: purchasedAt,
            periodo_fim: subscription_end,
            metadata: {
              revenuecat_event_type: event.type,
              product_id: event.product_id,
              store: event.store,
              environment: event.environment,
              original_price: event.price_in_purchased_currency || event.price || null
            }
          });

        if (faturamentoError) {
          console.error('❌ Error recording payment in faturamento:', faturamentoError);
        } else {
          console.log('✅ Payment recorded in faturamento successfully');
        }
      } else {
        console.log('⚠️ Payment already exists in faturamento, skipping duplicate');
      }
    }

    console.log(`🎉 Updated subscription for user ${app_user_id}:`, {
      subscribed,
      subscription_tier,
      subscription_end
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Subscription updated for user ${app_user_id}`,
        data: { subscribed, subscription_tier, subscription_end }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('💥 Error processing RevenueCat webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
