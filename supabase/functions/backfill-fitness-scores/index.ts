import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BioPeakActivity {
  date: string;
  duration_seconds: number;
  distance_meters?: number;
  avg_hr?: number;
  max_hr?: number;
  avg_pace_min_km?: number;
  elevation_gain?: number;
  activity_type: string;
  source: string;
}

interface BackfillParams {
  startDate?: string;
  endDate?: string;
  batchSize?: number;
  offset?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // IMPORTANT: pass the service key as a Bearer JWT too (not only apikey),
    // so RLS helpers like auth.jwt()/auth.role() evaluate as service_role.
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const params: BackfillParams = await req.json().catch(() => ({}));
    
    const startDate = params.startDate || '2025-11-17';
    const endDate = params.endDate || new Date().toISOString().split('T')[0];
    const batchSize = params.batchSize || 10; // Reduced to avoid CPU timeout
    const offset = params.offset || 0;

    console.log(`🚀 Starting backfill: ${startDate} to ${endDate}, batch ${batchSize}, offset ${offset}`);

    // Fetch active subscribers first
    const { data: activeSubscribers, error: subsError } = await supabase
      .from('subscribers')
      .select('user_id')
      .eq('subscribed', true);

    if (subsError) {
      console.error('❌ Error fetching subscribers:', subsError);
      throw subsError;
    }

    const activeUserIds = new Set(activeSubscribers?.map(s => s.user_id) || []);
    console.log(`🔑 Found ${activeUserIds.size} active subscribers`);

    // Get distinct users with activities in the period
    // Note: Using limit 50000 to avoid Supabase's default 1000 row limit
    const { data: usersWithActivities, error: usersError } = await supabase
      .from('all_activities')
      .select('user_id')
      .gte('activity_date', startDate)
      .lte('activity_date', endDate)
      .order('user_id')
      .limit(50000);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      throw usersError;
    }

    // Filter only active subscribers with activities
    const uniqueUserIds = [...new Set(usersWithActivities?.map(u => u.user_id) || [])]
      .filter(userId => activeUserIds.has(userId));
    const totalUsers = uniqueUserIds.length;
    
    console.log(`📊 Total active subscribers with activities: ${totalUsers}`);

    // Apply batch limits
    const usersToProcess = uniqueUserIds.slice(offset, offset + batchSize);
    
    if (usersToProcess.length === 0) {
      console.log('✅ No more users to process');
      return new Response(JSON.stringify({
        success: true,
        message: 'Backfill complete - no more users',
        processed: 0,
        totalUsers,
        offset,
        nextOffset: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Processing users ${offset + 1} to ${offset + usersToProcess.length} of ${totalUsers}`);

    let totalScoresCreated = 0;
    let usersProcessed = 0;
    const errors: string[] = [];

    // Process users in parallel chunks of 5 for better performance
    const chunkSize = 5;
    for (let i = 0; i < usersToProcess.length; i += chunkSize) {
      const chunk = usersToProcess.slice(i, i + chunkSize);
      
      const results = await Promise.allSettled(
        chunk.map(async (userId) => {
          // Get all dates with activities for this user in the period
          const { data: userActivities, error: activitiesError } = await supabase
            .from('all_activities')
            .select('activity_date')
            .eq('user_id', userId)
            .gte('activity_date', startDate)
            .lte('activity_date', endDate);

          if (activitiesError) {
            throw new Error(`Error fetching activities: ${activitiesError.message}`);
          }

          // Get unique dates
          const uniqueDates = [...new Set(userActivities?.map(a => a.activity_date).filter(Boolean) || [])];
          
          console.log(`👤 User ${userId}: ${uniqueDates.length} unique dates to process`);

          let scoresCreated = 0;
          for (const targetDate of uniqueDates) {
            try {
              await calculateAndSaveFitnessScore(supabase, userId, targetDate);
              scoresCreated++;
            } catch (scoreError) {
              console.error(`❌ Error calculating score for ${userId} on ${targetDate}:`, scoreError);
            }
          }
          
          return scoresCreated;
        })
      );
      
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          usersProcessed++;
          totalScoresCreated += result.value;
        } else {
          errors.push(`User ${chunk[idx]}: ${result.reason?.message || 'Unknown error'}`);
        }
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const nextOffset = offset + batchSize < totalUsers ? offset + batchSize : null;

    console.log(`✅ Batch complete: ${usersProcessed} users, ${totalScoresCreated} scores in ${duration}s`);

    return new Response(JSON.stringify({
      success: true,
      usersProcessed,
      scoresCreated: totalScoresCreated,
      totalUsers,
      offset,
      nextOffset,
      duration: `${duration}s`,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Backfill error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function calculateAndSaveFitnessScore(supabase: any, userId: string, targetDate: string): Promise<void> {
  const calculationDate = new Date(targetDate);
  const dateStr = calculationDate.toISOString().split('T')[0];

  // Get last 60 days of activities from all sources
  const sixtyDaysAgo = new Date(calculationDate);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const startDateStr = sixtyDaysAgo.toISOString().split('T')[0];

  // Build precise ISO bounds (UTC) for TIMESTAMPTZ comparisons
  const startISO = new Date(Date.UTC(
    sixtyDaysAgo.getUTCFullYear(),
    sixtyDaysAgo.getUTCMonth(),
    sixtyDaysAgo.getUTCDate(),
    0, 0, 0, 0
  )).toISOString();
  const endISO = new Date(Date.UTC(
    calculationDate.getUTCFullYear(),
    calculationDate.getUTCMonth(),
    calculationDate.getUTCDate(),
    23, 59, 59, 999
  )).toISOString();

  const activities: BioPeakActivity[] = [];

  // Garmin Activities
  const { data: garminActivities } = await supabase
    .from('garmin_activities')
    .select('activity_date, duration_in_seconds, distance_in_meters, average_heart_rate_in_beats_per_minute, max_heart_rate_in_beats_per_minute, average_pace_in_minutes_per_kilometer, total_elevation_gain_in_meters, activity_type')
    .eq('user_id', userId)
    .gte('activity_date', startDateStr)
    .lte('activity_date', dateStr);

  if (garminActivities) {
    activities.push(...garminActivities.map((a: any) => ({
      date: a.activity_date,
      duration_seconds: a.duration_in_seconds || 0,
      distance_meters: a.distance_in_meters,
      avg_hr: a.average_heart_rate_in_beats_per_minute,
      max_hr: a.max_heart_rate_in_beats_per_minute,
      avg_pace_min_km: a.average_pace_in_minutes_per_kilometer,
      elevation_gain: a.total_elevation_gain_in_meters,
      activity_type: a.activity_type || 'unknown',
      source: 'garmin'
    })));
  }

  // Strava Activities
  const { data: stravaActivities } = await supabase
    .from('strava_activities')
    .select('start_date, moving_time, distance, average_heartrate, max_heartrate, total_elevation_gain, type')
    .eq('user_id', userId)
    .gte('start_date', startISO)
    .lte('start_date', endISO);

  if (stravaActivities && stravaActivities.length > 0) {
    activities.push(...stravaActivities.map((a: any) => ({
      date: (a.start_date ? a.start_date.split('T')[0] : dateStr),
      duration_seconds: a.moving_time || 0,
      distance_meters: a.distance,
      avg_hr: a.average_heartrate,
      max_hr: a.max_heartrate,
      avg_pace_min_km: a.distance && a.moving_time ? (a.moving_time / 60) / (a.distance / 1000) : undefined,
      elevation_gain: a.total_elevation_gain,
      activity_type: a.type || 'unknown',
      source: 'strava'
    })));
  }

  // Polar Activities
  const { data: polarActivities } = await supabase
    .from('polar_activities')
    .select('start_time, duration, distance, average_heart_rate_bpm, maximum_heart_rate_bpm, activity_type')
    .eq('user_id', userId)
    .gte('start_time', startISO)
    .lte('start_time', endISO);

  if (polarActivities) {
    activities.push(...polarActivities.map((a: any) => {
      const durationMatch = a.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
      let durationSeconds = 0;
      if (durationMatch) {
        const hours = parseInt(durationMatch[1] || '0');
        const minutes = parseInt(durationMatch[2] || '0');
        const seconds = parseFloat(durationMatch[3] || '0');
        durationSeconds = hours * 3600 + minutes * 60 + seconds;
      }

      return {
        date: a.start_time?.split('T')[0] || dateStr,
        duration_seconds: durationSeconds,
        distance_meters: a.distance ? a.distance * 1000 : undefined,
        avg_hr: a.average_heart_rate_bpm,
        max_hr: a.maximum_heart_rate_bpm,
        avg_pace_min_km: a.distance && durationSeconds ? (durationSeconds / 60) / a.distance : undefined,
        elevation_gain: undefined,
        activity_type: a.activity_type || 'unknown',
        source: 'polar'
      };
    }));
  }

  // Strava GPX Activities
  const { data: stravaGpxActivities } = await supabase
    .from('strava_gpx_activities')
    .select('start_time, duration_in_seconds, distance_in_meters, average_heart_rate, max_heart_rate, total_elevation_gain_in_meters, activity_type')
    .eq('user_id', userId)
    .gte('start_time', startISO)
    .lte('start_time', endISO);

  if (stravaGpxActivities) {
    activities.push(...stravaGpxActivities.map((a: any) => ({
      date: a.start_time?.split('T')[0] || dateStr,
      duration_seconds: a.duration_in_seconds || 0,
      distance_meters: a.distance_in_meters != null ? Number(a.distance_in_meters) : undefined,
      avg_hr: a.average_heart_rate != null ? Number(a.average_heart_rate) : undefined,
      max_hr: a.max_heart_rate != null ? Number(a.max_heart_rate) : undefined,
      avg_pace_min_km: a.distance_in_meters && a.duration_in_seconds ? (a.duration_in_seconds / 60) / (Number(a.distance_in_meters) / 1000) : undefined,
      elevation_gain: a.total_elevation_gain_in_meters != null ? Number(a.total_elevation_gain_in_meters) : undefined,
      activity_type: a.activity_type || 'unknown',
      source: 'strava_gpx'
    })));
  }

  // Zepp GPX Activities
  const { data: zeppGpxActivities } = await supabase
    .from('zepp_gpx_activities')
    .select('start_time, duration_in_seconds, distance_in_meters, average_heart_rate, max_heart_rate, elevation_gain_meters, activity_type')
    .eq('user_id', userId)
    .gte('start_time', startISO)
    .lte('start_time', endISO);

  if (zeppGpxActivities) {
    activities.push(...zeppGpxActivities.map((a: any) => ({
      date: a.start_time?.split('T')[0] || dateStr,
      duration_seconds: a.duration_in_seconds || 0,
      distance_meters: a.distance_in_meters != null ? Number(a.distance_in_meters) : undefined,
      avg_hr: a.average_heart_rate != null ? Number(a.average_heart_rate) : undefined,
      max_hr: a.max_heart_rate != null ? Number(a.max_heart_rate) : undefined,
      avg_pace_min_km: a.distance_in_meters && a.duration_in_seconds ? (a.duration_in_seconds / 60) / (Number(a.distance_in_meters) / 1000) : undefined,
      elevation_gain: a.elevation_gain_meters != null ? Number(a.elevation_gain_meters) : undefined,
      activity_type: a.activity_type || 'unknown',
      source: 'zepp_gpx'
    })));
  }

  if (activities.length === 0) {
    return; // No activities to calculate
  }

  // Calculate BioPeak Strain for each activity
  const activitiesWithStrain = activities.map(activity => {
    const bps = calculateBioPeakStrain(activity);
    return { ...activity, bps };
  });

  // Group by date and calculate daily strain
  const dailyStrains = new Map<string, number>();
  activitiesWithStrain.forEach(activity => {
    const currentStrain = dailyStrains.get(activity.date) || 0;
    dailyStrains.set(activity.date, currentStrain + activity.bps);
  });

  // Calculate ATL (7-day) and CTL (42-day) with exponential weighting
  const sortedDates = Array.from(dailyStrains.keys()).sort().slice(-42);
  const todayStrain = dailyStrains.get(dateStr) || 0;

  let atl = 0;
  let ctl = 0;
  const atlDecay = 1 / 7;
  const ctlDecay = 1 / 42;

  sortedDates.forEach((date, index) => {
    const strain = dailyStrains.get(date) || 0;
    const daysAgo = sortedDates.length - 1 - index;
    atl += strain * Math.exp(-daysAgo * atlDecay);
    ctl += strain * Math.exp(-daysAgo * ctlDecay);
  });

  // Calculate the three components of BioPeak Fitness Score
  const capacityScore = Math.min(60, ctl / 20);
  const consistencyScore = calculateConsistencyScore(dailyStrains, dateStr);
  const recoveryBalanceScore = calculateRecoveryBalance(atl, ctl);

  const fitnessScore = Math.round((capacityScore + consistencyScore + recoveryBalanceScore) * 100) / 100;

  // Save to database
  const { error: upsertError } = await supabase
    .from('fitness_scores_daily')
    .upsert({
      user_id: userId,
      calendar_date: dateStr,
      fitness_score: fitnessScore,
      capacity_score: capacityScore,
      consistency_score: consistencyScore,
      recovery_balance_score: recoveryBalanceScore,
      daily_strain: todayStrain,
      atl_7day: atl,
      ctl_42day: ctl
    }, {
      onConflict: 'user_id,calendar_date'
    });

  if (upsertError) {
    throw upsertError;
  }
}

function calculateBioPeakStrain(activity: BioPeakActivity): number {
  const baseDuration = activity.duration_seconds / 60;
  if (baseDuration < 5) return 0;

  let strain = Math.log(baseDuration + 1) * 10;

  let intensityMultiplier = 1.0;
  
  if (activity.avg_hr && activity.max_hr) {
    const hrIntensity = activity.avg_hr / 180;
    intensityMultiplier = Math.max(0.5, Math.min(2.0, hrIntensity));
  } else if (activity.avg_pace_min_km) {
    const paceIntensity = Math.max(0.5, 6 / activity.avg_pace_min_km);
    intensityMultiplier = Math.min(2.0, paceIntensity);
  }

  strain *= intensityMultiplier;

  if (activity.elevation_gain && activity.elevation_gain > 50) {
    const elevationBonus = Math.log(activity.elevation_gain / 100 + 1) * 5;
    strain += elevationBonus;
  }

  const sportMultipliers: Record<string, number> = {
    'running': 1.2,
    'cycling': 1.0,
    'swimming': 1.3,
    'strength': 0.8,
    'yoga': 0.3,
    'walking': 0.4,
    'hiking': 0.7
  };

  const activityTypeLower = activity.activity_type.toLowerCase();
  for (const [sport, multiplier] of Object.entries(sportMultipliers)) {
    if (activityTypeLower.includes(sport)) {
      strain *= multiplier;
      break;
    }
  }

  return Math.round(strain * 100) / 100;
}

function calculateConsistencyScore(dailyStrains: Map<string, number>, targetDate: string): number {
  const fourteenDaysAgo = new Date(targetDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  let activeDays = 0;
  
  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(fourteenDaysAgo);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];
    const strain = dailyStrains.get(dateStr) || 0;
    if (strain > 0) activeDays++;
  }

  const consistencyRatio = activeDays / 14;
  return Math.min(20, consistencyRatio * 20);
}

function calculateRecoveryBalance(atl: number, ctl: number): number {
  if (ctl === 0) return 10;
  
  const ratio = atl / ctl;
  
  if (ratio >= 0.8 && ratio <= 1.2) {
    return 20;
  } else if (ratio >= 0.6 && ratio <= 1.5) {
    return 15;
  } else if (ratio >= 0.4 && ratio <= 2.0) {
    return 10;
  } else {
    return 5;
  }
}
