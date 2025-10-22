import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[QUICK-CHECK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Quick check started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    
    logStep("User authenticated", { userId: user.id });

    // Fast database-only check
    const { data, error } = await supabaseClient
      .from('subscribers')
      .select('subscribed, subscription_type, subscription_tier, subscription_end')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      logStep("Database query error", { error: error.message });
      throw error;
    }

    // Validate subscription hasn't expired
    const isValid = data?.subscribed && 
                    data?.subscription_end && 
                    new Date(data.subscription_end) > new Date();

    logStep("Quick check result", { 
      isValid, 
      subscription_end: data?.subscription_end,
      current_time: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      subscribed: isValid || false,
      subscription_type: isValid ? data.subscription_type : null,
      subscription_tier: isValid ? data.subscription_tier : null,
      subscription_end: isValid ? data.subscription_end : null,
      source: 'database_quick_check'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in quick-check", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      subscribed: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
