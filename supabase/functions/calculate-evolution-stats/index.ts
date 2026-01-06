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

// UTC Helper: Convert Date to YYYY-MM-DD string in UTC
function toDateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// UTC Helper: Parse YYYY-MM-DD string to Date at UTC noon (avoids DST issues)
function parseDateKeyToUTCNoon(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

// UTC version: Get the Monday (ISO week start) for a given date, all in UTC
function getISOWeekStartUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  // day: 0=Sunday, 1=Monday, ..., 6=Saturday
  // diff: how many days to subtract to get to Monday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Get week label from date key string (no timezone involved)
function getWeekLabelFromKey(dateKey: string): string {
  // dateKey is YYYY-MM-DD, return DD/MM
  const parts = dateKey.split('-');
  return `${parts[2]}/${parts[1]}`;
}

interface Activity {
  user_id: string;
  activity_date: string;
  activity_source: string;
  activity_type: string;
  total_distance_meters: number | null;
  total_time_minutes: number | null;
  pace_min_per_km: number | null;
  average_heart_rate: number | null;
  max_heart_rate: number | null;
  active_kilocalories: number | null;
}

interface FitnessScore {
  user_id: string;
  calendar_date: string;
  fitness_score: number;
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

    // Generate all 8 weeks using UTC (from oldest to newest)
    const allWeeks: string[] = [];
    const todayKey = toDateKeyUTC(new Date());
    const todayUTCNoon = parseDateKeyToUTCNoon(todayKey);
    const currentWeekStart = getISOWeekStartUTC(todayUTCNoon);
    
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setUTCDate(weekStart.getUTCDate() - (i * 7));
      allWeeks.push(toDateKeyUTC(weekStart));
    }

    // Use the oldest week as filter start date
    const oldestWeekKey = allWeeks[0];

    if (targetUserId) {
      console.log(`[calculate-evolution-stats] Generated weeks: ${JSON.stringify(allWeeks)}`);
      console.log(`[calculate-evolution-stats] Filter start date: ${oldestWeekKey}`);
    }

    // Build query for activities from all_activities table
    let activitiesQuery = supabase
      .from('all_activities')
      .select('user_id, activity_date, activity_source, activity_type, total_distance_meters, total_time_minutes, pace_min_per_km, average_heart_rate, max_heart_rate, active_kilocalories')
      .gte('activity_date', oldestWeekKey)
      .order('activity_date', { ascending: true });

    if (targetUserId) {
      activitiesQuery = activitiesQuery.eq('user_id', targetUserId);
    }

    const { data: activities, error: activitiesError } = await activitiesQuery;

    if (activitiesError) {
      console.error("[calculate-evolution-stats] Error fetching activities:", activitiesError);
      throw activitiesError;
    }

    console.log(`[calculate-evolution-stats] Fetched ${activities?.length || 0} activities from all_activities`);

    // Build query for fitness scores
    let fitnessQuery = supabase
      .from('fitness_scores_daily')
      .select('user_id, calendar_date, fitness_score')
      .gte('calendar_date', oldestWeekKey)
      .order('calendar_date', { ascending: true });

    if (targetUserId) {
      fitnessQuery = fitnessQuery.eq('user_id', targetUserId);
    }

    const { data: fitnessScores, error: fitnessError } = await fitnessQuery;

    if (fitnessError) {
      console.error("[calculate-evolution-stats] Error fetching fitness scores:", fitnessError);
      // Don't throw - continue without fitness scores
    }

    console.log(`[calculate-evolution-stats] Fetched ${fitnessScores?.length || 0} fitness scores`);

    if ((!activities || activities.length === 0) && (!fitnessScores || fitnessScores.length === 0)) {
      // If processing single user with no data, still save empty stats
      if (targetUserId) {
        const emptyStats = generateEmptyStats(allWeeks);
        await supabase.from('user_evolution_stats').upsert({
          user_id: targetUserId,
          stats_data: emptyStats,
          calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        console.log(`[calculate-evolution-stats] Empty stats saved for user ${targetUserId}`);
      }
      return new Response(JSON.stringify({ success: true, message: "No data found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log sample activities for debugging when targeting specific user
    if (targetUserId && activities && activities.length > 0) {
      const sampleActs = activities.slice(0, 5).map(a => ({
        activity_date: a.activity_date,
        activity_type: a.activity_type,
        distance: a.total_distance_meters,
      }));
      console.log(`[calculate-evolution-stats] Sample activities: ${JSON.stringify(sampleActs)}`);
    }

    // Get all unique user IDs from both activities and fitness scores
    const userIdsFromActivities = new Set((activities || []).map(a => a.user_id));
    const userIdsFromFitness = new Set((fitnessScores || []).map(f => f.user_id));
    const allUserIds = new Set([...userIdsFromActivities, ...userIdsFromFitness]);

    // Group activities by user
    const userActivities: Record<string, Activity[]> = {};
    for (const activity of (activities || [])) {
      if (!userActivities[activity.user_id]) {
        userActivities[activity.user_id] = [];
      }
      userActivities[activity.user_id].push(activity as Activity);
    }

    // Group fitness scores by user
    const userFitnessScores: Record<string, FitnessScore[]> = {};
    for (const score of (fitnessScores || [])) {
      if (!userFitnessScores[score.user_id]) {
        userFitnessScores[score.user_id] = [];
      }
      userFitnessScores[score.user_id].push(score as FitnessScore);
    }

    console.log(`[calculate-evolution-stats] Processing ${allUserIds.size} users`);

    // Process each user
    for (const userId of allUserIds) {
      try {
        const userActs = userActivities[userId] || [];
        const userFitness = userFitnessScores[userId] || [];

        // Deduplicate activities: prioritize Garmin over Strava for same date
        const deduplicatedByDate: Record<string, Activity> = {};
        for (const act of userActs) {
          // Normalize date key (handle both DATE and TIMESTAMP formats)
          const actDayKey = (act.activity_date || '').slice(0, 10);
          if (!deduplicatedByDate[actDayKey]) {
            deduplicatedByDate[actDayKey] = act;
          } else if (act.activity_source === 'garmin' && deduplicatedByDate[actDayKey].activity_source !== 'garmin') {
            deduplicatedByDate[actDayKey] = act;
          }
        }
        const dedupedActivities = Object.values(deduplicatedByDate);

        // Group activities by week using UTC-consistent logic
        const weeklyData: Record<string, Activity[]> = {};
        for (const weekKey of allWeeks) {
          weeklyData[weekKey] = [];
        }

        for (const act of dedupedActivities) {
          const actDayKey = (act.activity_date || '').slice(0, 10);
          const actDateUTCNoon = parseDateKeyToUTCNoon(actDayKey);
          const weekStart = getISOWeekStartUTC(actDateUTCNoon);
          const weekKey = toDateKeyUTC(weekStart);
          
          if (weeklyData[weekKey]) {
            weeklyData[weekKey].push(act);
          }
        }

        // Debug logging for targeted user
        if (targetUserId === userId) {
          const weekCounts: Record<string, number> = {};
          for (const [wk, acts] of Object.entries(weeklyData)) {
            weekCounts[wk] = acts.length;
          }
          console.log(`[calculate-evolution-stats] Week activity counts: ${JSON.stringify(weekCounts)}`);
        }

        // Calculate stats for each metric
        const fitnessScoreEvolution: { week: string; fitnessScore: number | null }[] = [];
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

        for (const weekKey of allWeeks) {
          const weekActivities = weeklyData[weekKey];
          const weekLabel = getWeekLabelFromKey(weekKey);

          // Fitness Score - average of week (from fitness_scores_daily)
          const weekFitnessScores = userFitness
            .filter(f => {
              const fDateKey = (f.calendar_date || '').slice(0, 10);
              const fDateUTCNoon = parseDateKeyToUTCNoon(fDateKey);
              const fWeekStart = getISOWeekStartUTC(fDateUTCNoon);
              return toDateKeyUTC(fWeekStart) === weekKey;
            })
            .map(f => f.fitness_score)
            .filter((v): v is number => v !== null && v > 0);
          
          const avgFitnessScore = weekFitnessScores.length > 0
            ? weekFitnessScores.reduce((a, b) => a + b, 0) / weekFitnessScores.length
            : null;
          fitnessScoreEvolution.push({ 
            week: weekLabel, 
            fitnessScore: avgFitnessScore ? Math.round(avgFitnessScore * 10) / 10 : null 
          });

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
          fitnessScoreEvolution,
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
        usersProcessed: allUserIds.size,
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

// Helper to generate empty stats structure
function generateEmptyStats(allWeeks: string[]) {
  const emptyWeekData = (weekKey: string) => getWeekLabelFromKey(weekKey);
  
  return {
    calculatedAt: new Date().toISOString(),
    fitnessScoreEvolution: allWeeks.map(w => ({ week: emptyWeekData(w), fitnessScore: null })),
    distanceEvolution: allWeeks.map(w => ({ week: emptyWeekData(w), totalKm: 0 })),
    paceEvolution: {
      cycling: allWeeks.map(w => ({ week: emptyWeekData(w), avgPace: null })),
      running: allWeeks.map(w => ({ week: emptyWeekData(w), avgPace: null })),
      swimming: allWeeks.map(w => ({ week: emptyWeekData(w), avgPace: null })),
      walking: allWeeks.map(w => ({ week: emptyWeekData(w), avgPace: null })),
      other: allWeeks.map(w => ({ week: emptyWeekData(w), avgPace: null })),
    },
    heartRateEvolution: allWeeks.map(w => ({ week: emptyWeekData(w), avgHR: null, maxHR: null })),
    caloriesEvolution: allWeeks.map(w => ({ week: emptyWeekData(w), totalCalories: 0 })),
    activityDistribution: [],
  };
}
