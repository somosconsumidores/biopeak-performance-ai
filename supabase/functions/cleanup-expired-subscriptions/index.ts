import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLEANUP-EXPIRED-SUBS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Starting cleanup of expired subscriptions");

    // Find all users with subscribed = true but subscription_end in the past
    const { data: expiredSubs, error: fetchError } = await supabaseAdmin
      .from('subscribers')
      .select('*')
      .eq('subscribed', true)
      .lt('subscription_end', new Date().toISOString());

    if (fetchError) {
      throw new Error(`Error fetching expired subscriptions: ${fetchError.message}`);
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      logStep("No expired subscriptions found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No expired subscriptions to clean up",
          cleaned: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    logStep(`Found ${expiredSubs.length} expired subscriptions to clean up`);

    let cleanedCount = 0;
    const errors = [];

    for (const sub of expiredSubs) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from('subscribers')
          .update({
            subscribed: false,
            subscription_type: null,
            subscription_tier: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', sub.user_id);

        if (updateError) {
          errors.push({
            user_id: sub.user_id,
            email: sub.email,
            error: updateError.message
          });
          logStep('Error cleaning up subscription', { 
            userId: sub.user_id, 
            error: updateError.message 
          });
        } else {
          cleanedCount++;
          logStep('Expired subscription cleaned up', { 
            userId: sub.user_id,
            email: sub.email,
            subscription_end: sub.subscription_end
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({
          user_id: sub.user_id,
          email: sub.email,
          error: errorMsg
        });
        logStep('Exception cleaning up subscription', { 
          userId: sub.user_id, 
          error: errorMsg 
        });
      }
    }

    logStep(`Cleanup completed: ${cleanedCount} subscriptions cleaned, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleaned up ${cleanedCount} expired subscriptions`,
        cleaned: cleanedCount,
        total_found: expiredSubs.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in cleanup-expired-subscriptions', { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
