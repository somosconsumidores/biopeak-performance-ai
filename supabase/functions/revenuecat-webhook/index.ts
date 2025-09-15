import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const webhook = await req.json()
    console.log('RevenueCat webhook received:', JSON.stringify(webhook, null, 2))

    const { event, app_user_id } = webhook

    if (!app_user_id) {
      console.log('No app_user_id found in webhook')
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Mapear eventos RevenueCat para status de assinatura
    let subscribed = false
    let subscription_tier = null
    let subscription_end = null

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
        subscribed = true
        subscription_tier = 'premium'
        // RevenueCat envia expiration_at_ms
        if (event.expiration_at_ms) {
          subscription_end = new Date(event.expiration_at_ms).toISOString()
        }
        break

      case 'CANCELLATION':
      case 'EXPIRATION':
        subscribed = false
        subscription_tier = null
        subscription_end = null
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
    }

    // Atualizar status de assinatura no Supabase
    const { error } = await supabase
      .from('subscribers')
      .upsert({
        user_id: app_user_id,
        subscribed,
        subscription_tier,
        subscription_end,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error updating subscription:', error)
      throw error
    }

    console.log(`Updated subscription for user ${app_user_id}:`, {
      subscribed,
      subscription_tier,
      subscription_end
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Subscription updated for user ${app_user_id}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing RevenueCat webhook:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})