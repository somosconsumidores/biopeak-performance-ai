// Edge function to get weekly summary statistics for all users
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular semana anterior (segunda a domingo)
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // 0 = domingo
    const lastMonday = new Date(today);
    lastMonday.setUTCDate(today.getUTCDate() - dayOfWeek - 6);
    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);

    const startDate = lastMonday.toISOString().slice(0, 10);
    const endDate = lastSunday.toISOString().slice(0, 10);

    console.log(`Fetching weekly summary from ${startDate} to ${endDate}`);

    // Chamar função SQL agregada
    const { data, error } = await supabase.rpc("weekly_summary_stats", {
      start_date: startDate,
      end_date: endDate,
    });

    if (error) {
      console.error("Error fetching weekly summary:", error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Successfully fetched ${data?.length || 0} user summaries`);

    return new Response(
      JSON.stringify(data), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error in weekly-summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
