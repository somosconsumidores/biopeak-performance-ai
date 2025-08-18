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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, target_date } = await req.json();
    const calculationDate = target_date ? new Date(target_date) : new Date();
    const dateStr = calculationDate.toISOString().split('T')[0];
    
    console.log(`🔄 Calculating BioPeak Fitness Score for user ${user_id} on ${dateStr}`);

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
    console.log(`⏱️ Date bounds -> start: ${startISO}, end: ${endISO}`);
    // Fetch activities from all sources
    const activities: BioPeakActivity[] = [];

    // Garmin Activities
    const { data: garminActivities, error: garminError } = await supabase
      .from('garmin_activities')
      .select('activity_date, duration_in_seconds, distance_in_meters, average_heart_rate_in_beats_per_minute, max_heart_rate_in_beats_per_minute, average_pace_in_minutes_per_kilometer, total_elevation_gain_in_meters, activity_type')
      .eq('user_id', user_id)
      .gte('activity_date', startDateStr)
      .lte('activity_date', dateStr);

    if (garminError) {
      console.error('❌ Garmin query error:', garminError.message);
    }
    if (garminActivities) {
      activities.push(...garminActivities.map(a => ({
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
      console.log(`📈 Garmin activities considered: ${garminActivities.length}`);
    }

    // Strava Activities
    const { data: stravaActivities, error: stravaError } = await supabase
      .from('strava_activities')
      .select('start_date, moving_time, distance, average_heartrate, max_heartrate, total_elevation_gain, type')
      .eq('user_id', user_id)
      .gte('start_date', startISO)
      .lte('start_date', endISO);

    if (stravaError) {
      console.error('❌ Strava query error:', stravaError.message);
    }
    if (stravaActivities) {
      activities.push(...stravaActivities.map(a => ({
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
      console.log(`📈 Strava activities considered: ${stravaActivities.length}`);
    }

    // Polar Activities
    const { data: polarActivities, error: polarError } = await supabase
      .from('polar_activities')
      .select('start_time, duration, distance, average_heart_rate_bpm, maximum_heart_rate_bpm, activity_type')
      .eq('user_id', user_id)
      .gte('start_time', startISO)
      .lte('start_time', endISO);

    if (polarError) {
      console.error('❌ Polar query error:', polarError.message);
    }
    if (polarActivities) {
      activities.push(...polarActivities.map(a => {
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
      console.log(`📈 Polar activities considered: ${polarActivities.length}`);
    }

    // Strava GPX Activities
    const { data: stravaGpxActivities, error: stravaGpxError } = await supabase
      .from('strava_gpx_activities')
      .select('start_time, duration_in_seconds, distance_in_meters, average_heart_rate, max_heart_rate, total_elevation_gain_in_meters, activity_type')
      .eq('user_id', user_id)
      .gte('start_time', startISO)
      .lte('start_time', endISO);

    if (stravaGpxError) {
      console.error('❌ Strava GPX query error:', stravaGpxError.message);
    }
    if (stravaGpxActivities) {
      activities.push(...stravaGpxActivities.map(a => ({
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
      console.log(`📈 Strava GPX activities considered: ${stravaGpxActivities.length}`);
    }

    // Zepp GPX Activities
    const { data: zeppGpxActivities, error: zeppGpxError } = await supabase
      .from('zepp_gpx_activities')
      .select('start_time, duration_in_seconds, distance_in_meters, average_heart_rate, max_heart_rate, elevation_gain_meters, activity_type')
      .eq('user_id', user_id)
      .gte('start_time', startISO)
      .lte('start_time', endISO);

    if (zeppGpxError) {
      console.error('❌ Zepp GPX query error:', zeppGpxError.message);
    }
    if (zeppGpxActivities) {
      activities.push(...zeppGpxActivities.map(a => ({
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
      console.log(`📈 Zepp GPX activities considered: ${zeppGpxActivities.length}`);
    }

    console.log(`📊 Found ${activities.length} activities for calculation`);
    // Calculate BioPeak Strain (BPS) for each activity
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
    const sortedDates = Array.from(dailyStrains.keys()).sort().slice(-42); // Last 42 days
    const todayStrain = dailyStrains.get(dateStr) || 0;

    let atl = 0;
    let ctl = 0;
    const atlDecay = 1 / 7; // 7-day decay
    const ctlDecay = 1 / 42; // 42-day decay

    sortedDates.forEach((date, index) => {
      const strain = dailyStrains.get(date) || 0;
      const daysAgo = sortedDates.length - 1 - index;
      
      // Exponentially weighted moving average
      atl += strain * Math.exp(-daysAgo * atlDecay);
      ctl += strain * Math.exp(-daysAgo * ctlDecay);
    });

    // Calculate the three components of BioPeak Fitness Score
    const capacityScore = Math.min(60, ctl / 20); // 0-60 points from CTL
    const consistencyScore = calculateConsistencyScore(dailyStrains, dateStr); // 0-20 points
    const recoveryBalanceScore = calculateRecoveryBalance(atl, ctl); // 0-20 points

    const fitnessScore = Math.round((capacityScore + consistencyScore + recoveryBalanceScore) * 100) / 100;

    console.log(`✅ BioPeak Fitness Score calculated: ${fitnessScore} (Capacity: ${capacityScore.toFixed(1)}, Consistency: ${consistencyScore.toFixed(1)}, Recovery: ${recoveryBalanceScore.toFixed(1)})`);

    // Save to database
    const { error: upsertError } = await supabase
      .from('fitness_scores_daily')
      .upsert({
        user_id,
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
      console.error('❌ Error saving fitness score:', upsertError);
      throw upsertError;
    }

    return new Response(JSON.stringify({
      success: true,
      fitness_score: fitnessScore,
      components: {
        capacity_score: capacityScore,
        consistency_score: consistencyScore,
        recovery_balance_score: recoveryBalanceScore
      },
      metrics: {
        daily_strain: todayStrain,
        atl_7day: atl,
        ctl_42day: ctl
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error calculating fitness score:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateBioPeakStrain(activity: BioPeakActivity): number {
  const baseDuration = activity.duration_seconds / 60; // Convert to minutes
  if (baseDuration < 5) return 0; // Skip very short activities

  // Base strain from duration (logarithmic scaling)
  let strain = Math.log(baseDuration + 1) * 10;

  // Intensity multiplier based on heart rate or pace
  let intensityMultiplier = 1.0;
  
  if (activity.avg_hr && activity.max_hr) {
    // Heart rate intensity (assuming max_hr of 200 for normalization)
    const hrIntensity = activity.avg_hr / 180; // Normalize to reasonable max
    intensityMultiplier = Math.max(0.5, Math.min(2.0, hrIntensity));
  } else if (activity.avg_pace_min_km) {
    // Pace intensity (faster pace = higher intensity)
    // Assume 6 min/km as moderate, 4 min/km as very high
    const paceIntensity = Math.max(0.5, 6 / activity.avg_pace_min_km);
    intensityMultiplier = Math.min(2.0, paceIntensity);
  }

  strain *= intensityMultiplier;

  // Elevation bonus
  if (activity.elevation_gain && activity.elevation_gain > 50) {
    const elevationBonus = Math.log(activity.elevation_gain / 100 + 1) * 5;
    strain += elevationBonus;
  }

  // Sport-specific multipliers
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
  // Look at last 14 days for consistency
  const fourteenDaysAgo = new Date(targetDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  let activeDays = 0;
  const last14Days = [];
  
  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(fourteenDaysAgo);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];
    const strain = dailyStrains.get(dateStr) || 0;
    
    last14Days.push(strain);
    if (strain > 0) activeDays++;
  }

  // Consistency score based on active days (0-20 points)
  const consistencyRatio = activeDays / 14;
  return Math.min(20, consistencyRatio * 20);
}

function calculateRecoveryBalance(atl: number, ctl: number): number {
  if (ctl === 0) return 10; // Neutral if no training load
  
  const tsb = ctl - atl; // Training Stress Balance
  const ratio = atl / ctl;
  
  // Optimal ratio is around 0.8-1.2 (slightly peaked to fresh)
  let recoveryScore;
  if (ratio >= 0.8 && ratio <= 1.2) {
    recoveryScore = 20; // Optimal balance
  } else if (ratio >= 0.6 && ratio <= 1.5) {
    recoveryScore = 15; // Good balance
  } else if (ratio >= 0.4 && ratio <= 2.0) {
    recoveryScore = 10; // Acceptable balance
  } else {
    recoveryScore = 5; // Poor balance (over-reached or detrained)
  }

  return recoveryScore;
}