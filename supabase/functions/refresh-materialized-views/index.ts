import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Starting materialized views refresh...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Refresh mv_all_activities_30_days
    console.log("Refreshing mv_all_activities_30_days...");
    const { error: error1 } = await supabase.rpc("refresh_mv_all_activities_30_days");
    
    if (error1) {
      console.error("Error refreshing mv_all_activities_30_days:", error1);
      throw error1;
    }
    console.log("mv_all_activities_30_days refreshed successfully");

    // Refresh mv_active_subscribers
    console.log("Refreshing mv_active_subscribers...");
    const { error: error2 } = await supabase.rpc("refresh_mv_active_subscribers");
    
    if (error2) {
      console.error("Error refreshing mv_active_subscribers:", error2);
      throw error2;
    }
    console.log("mv_active_subscribers refreshed successfully");

    console.log("All materialized views refreshed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Materialized views refreshed successfully",
        refreshed_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error refreshing materialized views:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
