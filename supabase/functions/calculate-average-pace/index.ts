import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AggregatedData {
  category: string;
  total_distance: number;
  total_time: number;
  activity_count: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[calculate-average-pace] Starting calculation using RPC aggregation...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      },
    });

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const periodEnd = today.toISOString().split("T")[0];
    const periodStart = thirtyDaysAgo.toISOString().split("T")[0];

    console.log(`[calculate-average-pace] Period: ${periodStart} to ${periodEnd}`);

    // Use RPC to aggregate data directly in the database (no 1000 row limit)
    const { data: aggregated, error: rpcError } = await supabase.rpc(
      "calculate_average_pace_aggregation",
      {
        p_period_start: periodStart,
        p_period_end: periodEnd,
      }
    );

    if (rpcError) {
      console.error("[calculate-average-pace] RPC error:", rpcError);
      throw rpcError;
    }

    console.log(`[calculate-average-pace] RPC returned ${aggregated?.length || 0} categories`);

    // Calculate average pace for each category and insert into database
    const results: { category: string; pace: number; unit: string; activities: number }[] = [];
    const now = new Date().toISOString();

    for (const data of (aggregated as AggregatedData[]) || []) {
      if (!data.category || data.activity_count === 0 || data.total_distance === 0 || data.total_time === 0) {
        console.log(`[calculate-average-pace] Skipping invalid data:`, data);
        continue;
      }

      let averagePaceValue: number;
      let paceUnit: string;

      if (data.category === "RUNNING") {
        // Pace in min/km = Total Minutes / (Total Meters / 1000)
        averagePaceValue = data.total_time / (data.total_distance / 1000);
        paceUnit = "min/km";
      } else if (data.category === "CYCLING") {
        // Speed in km/h = (Total Meters / 1000) / (Total Minutes / 60)
        averagePaceValue = (data.total_distance / 1000) / (data.total_time / 60);
        paceUnit = "km/h";
      } else if (data.category === "SWIMMING") {
        // Pace in min/100m = Total Minutes / (Total Meters / 100)
        averagePaceValue = data.total_time / (data.total_distance / 100);
        paceUnit = "min/100m";
      } else {
        continue;
      }

      console.log(`[calculate-average-pace] ${data.category}: ${averagePaceValue.toFixed(2)} ${paceUnit} (${data.activity_count} activities)`);

      const { error: insertError } = await supabase
        .from("average_pace")
        .insert({
          calculated_at: now,
          period_start: periodStart,
          period_end: periodEnd,
          category: data.category,
          average_pace_value: averagePaceValue,
          pace_unit: paceUnit,
          total_activities: data.activity_count,
          total_distance_meters: data.total_distance,
          total_time_minutes: data.total_time,
        });

      if (insertError) {
        console.error(`[calculate-average-pace] Error inserting ${data.category}:`, insertError);
        throw insertError;
      }

      results.push({
        category: data.category,
        pace: averagePaceValue,
        unit: paceUnit,
        activities: data.activity_count,
      });
    }

    console.log("[calculate-average-pace] Calculation completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Average pace calculated successfully",
        calculated_at: now,
        period: { start: periodStart, end: periodEnd },
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[calculate-average-pace] Error:", error);
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
