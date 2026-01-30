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

  console.log("[calculate-average-pace] Starting calculation...");

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

    // Fetch all activities from the last 30 days with valid distance and time
    const { data: activities, error: fetchError } = await supabase
      .from("all_activities")
      .select("activity_type, total_distance_meters, total_time_minutes")
      .gte("activity_date", periodStart)
      .lte("activity_date", periodEnd)
      .gt("total_distance_meters", 0)
      .gt("total_time_minutes", 0);

    if (fetchError) {
      console.error("[calculate-average-pace] Error fetching activities:", fetchError);
      throw fetchError;
    }

    console.log(`[calculate-average-pace] Found ${activities?.length || 0} activities`);

    // Activity type mappings
    const cyclingTypes = new Set([
      "RIDE", "CYCLING", "ROAD_BIKING", "VIRTUALRIDE", "MOUNTAIN_BIKING",
      "INDOOR_CYCLING", "VIRTUAL_RIDE", "EBIKERIDE", "VELOMOBILE"
    ]);

    const runningTypes = new Set([
      "RUN", "RUNNING", "TREADMILL_RUNNING", "INDOOR_CARDIO", "TRAIL_RUNNING",
      "VIRTUALRUN", "TRACK_RUNNING", "VIRTUAL_RUN", "INDOOR_RUNNING", "ULTRA_RUN", "FREE_RUN"
    ]);

    const swimmingTypes = new Set([
      "SWIM", "LAP_SWIMMING", "OPEN_WATER_SWIMMING", "SWIMMING"
    ]);

    // Aggregate data by category
    const aggregated: Record<string, AggregatedData> = {
      CYCLING: { category: "CYCLING", total_distance: 0, total_time: 0, activity_count: 0 },
      RUNNING: { category: "RUNNING", total_distance: 0, total_time: 0, activity_count: 0 },
      SWIMMING: { category: "SWIMMING", total_distance: 0, total_time: 0, activity_count: 0 },
    };

    for (const activity of activities || []) {
      const activityType = (activity.activity_type || "").toUpperCase();
      let category: string | null = null;

      if (cyclingTypes.has(activityType)) {
        category = "CYCLING";
      } else if (runningTypes.has(activityType)) {
        category = "RUNNING";
      } else if (swimmingTypes.has(activityType)) {
        category = "SWIMMING";
      }

      if (category) {
        aggregated[category].total_distance += activity.total_distance_meters || 0;
        aggregated[category].total_time += activity.total_time_minutes || 0;
        aggregated[category].activity_count += 1;
      }
    }

    // Calculate average pace for each category and insert into database
    const results: { category: string; pace: number; unit: string; activities: number }[] = [];
    const now = new Date().toISOString();

    for (const [category, data] of Object.entries(aggregated)) {
      if (data.activity_count === 0 || data.total_distance === 0 || data.total_time === 0) {
        console.log(`[calculate-average-pace] Skipping ${category}: no valid data`);
        continue;
      }

      let averagePaceValue: number;
      let paceUnit: string;

      if (category === "RUNNING") {
        // Pace in min/km = Total Minutes / (Total Meters / 1000)
        averagePaceValue = data.total_time / (data.total_distance / 1000);
        paceUnit = "min/km";
      } else if (category === "CYCLING") {
        // Speed in km/h = (Total Meters / 1000) / (Total Minutes / 60)
        averagePaceValue = (data.total_distance / 1000) / (data.total_time / 60);
        paceUnit = "km/h";
      } else if (category === "SWIMMING") {
        // Pace in min/100m = Total Minutes / (Total Meters / 100)
        averagePaceValue = data.total_time / (data.total_distance / 100);
        paceUnit = "min/100m";
      } else {
        continue;
      }

      console.log(`[calculate-average-pace] ${category}: ${averagePaceValue.toFixed(2)} ${paceUnit} (${data.activity_count} activities)`);

      const { error: insertError } = await supabase
        .from("average_pace")
        .insert({
          calculated_at: now,
          period_start: periodStart,
          period_end: periodEnd,
          category: category,
          average_pace_value: averagePaceValue,
          pace_unit: paceUnit,
          total_activities: data.activity_count,
          total_distance_meters: data.total_distance,
          total_time_minutes: data.total_time,
        });

      if (insertError) {
        console.error(`[calculate-average-pace] Error inserting ${category}:`, insertError);
        throw insertError;
      }

      results.push({
        category,
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
