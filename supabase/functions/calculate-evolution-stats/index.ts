import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Activity type groupings
const ACTIVITY_GROUPS = {
  cycling: ['Ride', 'CYCLING', 'ROAD_BIKING', 'VirtualRide', 'MOUNTAIN_BIKING', 'INDOOR_CYCLING', 'VIRTUAL_RIDE', 'EBikeRide', 'Velomobile'],
  running: ['Run', 'RUNNING', 'TREADMILL_RUNNING', 'INDOOR_CARDIO', 'TRAIL_RUNNING', 'VirtualRun', 'TRACK_RUNNING', 'VIRTUAL_RUN', 'INDOOR_RUNNING', 'ULTRA_RUN'],
  swimming: ['Swim', 'LAP_SWIMMING', 'OPEN_WATER_SWIMMING', 'SWIMMING'],
  walking: ['Walk', 'WALKING'],
};

function getActivityGroup(activityType: string): string {
  for (const [group, types] of Object.entries(ACTIVITY_GROUPS)) {
    if (types.includes(activityType)) return group;
  }
  return 'other';
}

function getWeekLabel(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

interface Activity {
  user_id: string;
  activity_date: string;
  activity_source: string;
  activity_type: string;
  vo2_max_daniels: number | null;
  total_distance_meters: number | null;
  pace_min_per_km: number | null;
  average_heart_rate: number | null;
  max_heart_rate: number | null;
  active_kilocalories: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional userId filter
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body.userId || null;
    } catch {
      // No body or invalid JSON - process all users
    }

    if (targetUserId) {
      console.log(`[calculate-evolution-stats] Processing single user: ${targetUserId}`);
    } else {
      console.log("[calculate-evolution-stats] Starting calculation for all users...");
    }

    // Get date 56 days ago (8 weeks)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 56);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Build query with optional user filter
    let query = supabase
      .from('v_all_activities_with_vo2_daniels')
      .select('user_id, activity_date, activity_source, activity_type, vo2_max_daniels, total_distance_meters, pace_min_per_km, average_heart_rate, max_heart_rate, active_kilocalories')
      .gte('activity_date', startDateStr)
      .order('activity_date', { ascending: true });

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: activities, error: activitiesError } = await query;

    if (activitiesError) {
      console.error("[calculate-evolution-stats] Error fetching activities:", activitiesError);
      throw activitiesError;
    }

    console.log(`[calculate-evolution-stats] Fetched ${activities?.length || 0} activities`);

    if (!activities || activities.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No activities found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group activities by user
    const userActivities: Record<string, Activity[]> = {};
    for (const activity of activities) {
      if (!userActivities[activity.user_id]) {
        userActivities[activity.user_id] = [];
      }
      userActivities[activity.user_id].push(activity as Activity);
    }

    console.log(`[calculate-evolution-stats] Processing ${Object.keys(userActivities).length} users`);

    // Process each user
    for (const [userId, userActs] of Object.entries(userActivities)) {
      try {
        // Deduplicate: prioritize Garmin over Strava for same date
        const deduplicatedByDate: Record<string, Activity> = {};
        for (const act of userActs) {
          const date = act.activity_date;
          if (!deduplicatedByDate[date]) {
            deduplicatedByDate[date] = act;
          } else if (act.activity_source === 'garmin' && deduplicatedByDate[date].activity_source !== 'garmin') {
            deduplicatedByDate[date] = act;
          }
        }
        const dedupedActivities = Object.values(deduplicatedByDate);

        // Generate all 8 weeks (from oldest to newest)
        const allWeeks: string[] = [];
        const today = new Date();
        for (let i = 7; i >= 0; i--) {
          const weekDate = new Date(today);
          weekDate.setDate(weekDate.getDate() - (i * 7));
          const weekStart = getISOWeekStart(weekDate);
          allWeeks.push(weekStart.toISOString().split('T')[0]);
        }

        // Group activities by week
        const weeklyData: Record<string, Activity[]> = {};
        for (const weekKey of allWeeks) {
          weeklyData[weekKey] = [];
        }
        for (const act of dedupedActivities) {
          const actDate = new Date(act.activity_date);
          const weekStart = getISOWeekStart(actDate);
          const weekKey = weekStart.toISOString().split('T')[0];
          if (weeklyData[weekKey]) {
            weeklyData[weekKey].push(act);
          }
        }

        // Use all 8 weeks in order
        const sortedWeeks = allWeeks;

        // Calculate stats for each metric
        const vo2Evolution: { week: string; vo2Max: number | null }[] = [];
        const distanceEvolution: { week: string; totalKm: number }[] = [];
        const heartRateEvolution: { week: string; avgHR: number | null; maxHR: number | null }[] = [];
        const caloriesEvolution: { week: string; totalCalories: number }[] = [];
        const paceEvolution: Record<string, { week: string; avgPace: number | null }[]> = {
          cycling: [],
          running: [],
          swimming: [],
          walking: [],
          other: [],
        };
        const activityCounts: Record<string, number> = {};

        for (const weekKey of sortedWeeks) {
          const weekActivities = weeklyData[weekKey];
          const weekLabel = getWeekLabel(new Date(weekKey));

          // VO2 Max - average of week
          const vo2Values = weekActivities
            .map(a => a.vo2_max_daniels)
            .filter((v): v is number => v !== null && v > 0);
          const avgVo2 = vo2Values.length > 0 
            ? vo2Values.reduce((a, b) => a + b, 0) / vo2Values.length 
            : null;
          vo2Evolution.push({ week: weekLabel, vo2Max: avgVo2 ? Math.round(avgVo2 * 10) / 10 : null });

          // Distance - sum of week
          const totalDistance = weekActivities
            .reduce((sum, a) => sum + (a.total_distance_meters || 0), 0);
          distanceEvolution.push({ week: weekLabel, totalKm: Math.round(totalDistance / 100) / 10 });

          // Heart rate - averages of week
          const hrValues = weekActivities.filter(a => a.average_heart_rate && a.average_heart_rate > 0);
          const avgHR = hrValues.length > 0
            ? Math.round(hrValues.reduce((sum, a) => sum + (a.average_heart_rate || 0), 0) / hrValues.length)
            : null;
          const maxHRValues = weekActivities.filter(a => a.max_heart_rate && a.max_heart_rate > 0);
          const maxHR = maxHRValues.length > 0
            ? Math.max(...maxHRValues.map(a => a.max_heart_rate || 0))
            : null;
          heartRateEvolution.push({ week: weekLabel, avgHR, maxHR });

          // Calories - sum of week
          const totalCalories = weekActivities
            .reduce((sum, a) => sum + (a.active_kilocalories || 0), 0);
          caloriesEvolution.push({ week: weekLabel, totalCalories: Math.round(totalCalories) });

          // Pace by activity type
          const paceByGroup: Record<string, number[]> = {
            cycling: [],
            running: [],
            swimming: [],
            walking: [],
            other: [],
          };

          for (const act of weekActivities) {
            const group = getActivityGroup(act.activity_type || '');
            if (act.pace_min_per_km && act.pace_min_per_km > 0) {
              paceByGroup[group].push(act.pace_min_per_km);
            }

            // Count activities by type for distribution
            const displayGroup = group === 'cycling' ? 'Ciclismo' 
              : group === 'running' ? 'Corrida'
              : group === 'swimming' ? 'Natação'
              : group === 'walking' ? 'Caminhada'
              : 'Outras';
            activityCounts[displayGroup] = (activityCounts[displayGroup] || 0) + 1;
          }

          for (const group of Object.keys(paceByGroup)) {
            const paces = paceByGroup[group];
            const avgPace = paces.length > 0
              ? Math.round((paces.reduce((a, b) => a + b, 0) / paces.length) * 10) / 10
              : null;
            paceEvolution[group].push({ week: weekLabel, avgPace });
          }
        }

        // Activity distribution
        const totalActivities = Object.values(activityCounts).reduce((a, b) => a + b, 0);
        const activityDistribution = Object.entries(activityCounts).map(([type, count]) => ({
          type,
          count,
          percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0,
        })).sort((a, b) => b.count - a.count);

        const statsData = {
          calculatedAt: new Date().toISOString(),
          vo2Evolution,
          distanceEvolution,
          paceEvolution,
          heartRateEvolution,
          caloriesEvolution,
          activityDistribution,
        };

        // Upsert stats for user
        const { error: upsertError } = await supabase
          .from('user_evolution_stats')
          .upsert({
            user_id: userId,
            stats_data: statsData,
            calculated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (upsertError) {
          console.error(`[calculate-evolution-stats] Error upserting stats for user ${userId}:`, upsertError);
        } else {
          console.log(`[calculate-evolution-stats] Stats saved for user ${userId}`);
        }
      } catch (userError) {
        console.error(`[calculate-evolution-stats] Error processing user ${userId}:`, userError);
      }
    }

    console.log("[calculate-evolution-stats] Calculation complete!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        usersProcessed: Object.keys(userActivities).length,
        message: "Evolution stats calculated successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-evolution-stats] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
