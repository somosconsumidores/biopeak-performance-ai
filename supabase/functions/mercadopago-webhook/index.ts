import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

// Timing-safe comparison to prevent timing attacks
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// Validate Mercado Pago webhook signature
async function validateWebhookSignature(
  signature: string,
  requestId: string,
  dataId: string,
  secret: string
): Promise<boolean> {
  try {
    // Parse x-signature header: "ts=1234567890,v1=abc123..."
    const parts = signature.split(',');
    const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
    const hash = parts.find(p => p.startsWith('v1='))?.split('=')[1];
    
    if (!ts || !hash) {
      console.warn('[MP Webhook] Invalid signature format');
      return false;
    }
    
    // Build manifest string according to MP documentation
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    
    // Calculate HMAC SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(manifest);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
    const expectedHash = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Timing-safe comparison
    const isValid = timingSafeEqual(
      encoder.encode(expectedHash),
      encoder.encode(hash)
    );
    
    if (!isValid) {
      console.warn('[MP Webhook] Signature mismatch', {
        expected: expectedHash.substring(0, 10) + '...',
        received: hash.substring(0, 10) + '...'
      });
    }
    
    return isValid;
  } catch (error) {
    console.error('[MP Webhook] Error validating signature:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Validate webhook signature
    const signature = req.headers.get('x-signature');
    const requestId = req.headers.get('x-request-id');
    const secret = Deno.env.get('SECRET_SIGNATURE_MERCADO_PAGO');

    if (!signature || !requestId) {
      console.warn('[MP Webhook] Missing required headers (x-signature or x-request-id)');
      return new Response(JSON.stringify({ error: 'Unauthorized - Missing signature headers' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!secret) {
      console.error('[MP Webhook] SECRET_SIGNATURE_MERCADO_PAGO not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = await req.json();
    console.log("[MP Webhook] Received notification:", JSON.stringify(payload));

    const dataId = payload.data?.id;
    if (!dataId) {
      console.warn('[MP Webhook] Missing data.id in payload');
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate signature
    const isValid = await validateWebhookSignature(signature, requestId, dataId.toString(), secret);
    
    if (!isValid) {
      console.warn('[MP Webhook] Invalid signature - potential security threat', {
        requestId,
        dataId
      });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[MP Webhook] Signature validated successfully');

    // Mercado Pago envia notificações com diferentes tipos
    if (payload.type === "payment") {
      const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      
      // Buscar detalhes do pagamento
      const paymentId = payload.data.id;
      console.log("[MP Webhook] Fetching payment details for:", paymentId);

      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          "Authorization": `Bearer ${mpAccessToken}`
        }
      });

      if (!paymentResponse.ok) {
        throw new Error(`Failed to fetch payment: ${paymentResponse.status}`);
      }

      const paymentData = await paymentResponse.json();
      console.log("[MP Webhook] Payment data:", JSON.stringify(paymentData));

      const userId = paymentData.external_reference; // user_id que enviamos
      const status = paymentData.status; // approved, rejected, pending, cancelled
      const planType = paymentData.metadata?.plan_type || "monthly";

      // Atualizar registro de pagamento
      const { error: updateError } = await supabaseService
        .from("mercadopago_payments")
        .update({
          payment_id: paymentId.toString(),
          status: status,
          payment_method: paymentData.payment_method_id,
          payment_type_id: paymentData.payment_type_id,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("status", "pending");

      if (updateError) {
        console.error("[MP Webhook] Error updating payment:", updateError);
      } else {
        console.log("[MP Webhook] Payment updated successfully");
      }

      // Se aprovado, ativar assinatura
      if (status === "approved") {
        const subscriptionEnd = new Date();
        
        if (planType === "annual") {
          subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
        } else {
          subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        }

        console.log("[MP Webhook] Activating subscription for user:", userId, "until:", subscriptionEnd);

        // Atualizar tabela subscribers
        const { error: subError } = await supabaseService
          .from("subscribers")
          .upsert({
            user_id: userId,
            subscribed: true,
            subscription_tier: planType,
            subscription_end: subscriptionEnd.toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: "user_id"
          });

        if (subError) {
          console.error("[MP Webhook] Error updating subscription:", subError);
        } else {
          console.log("[MP Webhook] Subscription activated successfully");
        }
      }
    } else {
      console.log("[MP Webhook] Ignoring notification type:", payload.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[MP Webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
