// One-time function to fix pending purchases that were already paid
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { paymentIntentId } = await req.json();

    if (!paymentIntentId) {
      throw new Error("Payment intent ID is required");
    }

    console.log('Fixing pending purchase for payment intent:', paymentIntentId);

    // Update the purchase to completed
    const { data, error } = await supabaseAdmin
      .from('ai_analysis_purchases')
      .update({
        status: 'completed',
        purchased_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .select();

    if (error) {
      console.error('Error updating purchase:', error);
      throw error;
    }

    console.log('Purchase updated successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true,
        updated: data 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fixing purchase:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
