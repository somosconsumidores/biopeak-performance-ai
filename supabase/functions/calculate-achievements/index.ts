import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AchievementDefinition {
  id: string;
  achievement_key: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  difficulty: string;
  points: number;
  requirement_type: string;
  requirement_value: number;
  requirement_metadata: any;
  is_active: boolean;
}

interface ActivityData {
  source: string;
  count: number;
  total_distance: number;
  total_duration: number;
  max_distance: number;
  min_pace: number;
  activities: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Starting achievement calculation for user: ${user_id}`);

    // 1. Buscar todas as conquistas ativas
    const { data: definitions, error: defError } = await supabase
      .from('achievement_definitions')
      .select('*')
      .eq('is_active', true);

    if (defError) {
      console.error('Error fetching achievement definitions:', defError);
      throw defError;
    }

    // 2. Buscar conquistas já desbloqueadas pelo usuário
    const { data: userAchievements, error: userError } = await supabase
      .from('user_achievements')
      .select('achievement_key')
      .eq('user_id', user_id);

    if (userError) {
      console.error('Error fetching user achievements:', userError);
      throw userError;
    }

    const unlockedKeys = new Set(userAchievements?.map(ua => ua.achievement_key) || []);

    // 3. Coletar dados de atividades de todas as fontes
    const activityData = await collectActivityData(supabase, user_id);
    console.log('Activity data collected:', activityData);

    // 4. Verificar cada conquista
    const newAchievements = [];
    const progressUpdates = [];

    for (const achievement of definitions || []) {
      if (unlockedKeys.has(achievement.achievement_key)) {
        continue; // Já desbloqueada
      }

      const result = await checkAchievement(achievement, activityData, supabase, user_id);
      
      if (result.unlocked) {
        // Desbloquear conquista
        const { error: insertError } = await supabase
          .from('user_achievements')
          .insert({
            user_id,
            achievement_key: achievement.achievement_key,
            progress_value: result.progress,
            is_seen: false
          });

        if (!insertError) {
          newAchievements.push(achievement);
          console.log(`Achievement unlocked: ${achievement.achievement_key}`);
        }
      }

      // Atualizar progresso
      if (result.progress > 0) {
        progressUpdates.push({
          user_id,
          achievement_key: achievement.achievement_key,
          current_value: result.progress,
          metadata: result.metadata || {}
        });
      }
    }

    // 5. Atualizar progresso em batch
    if (progressUpdates.length > 0) {
      const { error: progressError } = await supabase
        .from('achievement_progress')
        .upsert(progressUpdates, { 
          onConflict: 'user_id,achievement_key' 
        });

      if (progressError) {
        console.error('Error updating progress:', progressError);
      }
    }

    console.log(`Achievement check completed. New achievements: ${newAchievements.length}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        new_achievements: newAchievements,
        total_checked: definitions?.length || 0,
        progress_updated: progressUpdates.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-achievements:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function collectActivityData(supabase: any, userId: string): Promise<ActivityData> {
  const [garminData, stravaData, polarData] = await Promise.all([
    collectGarminData(supabase, userId),
    collectStravaData(supabase, userId),
    collectPolarData(supabase, userId)
  ]);

  const allActivities = [
    ...garminData.activities.map(a => ({ ...a, source: 'garmin' })),
    ...stravaData.activities.map(a => ({ ...a, source: 'strava' })),
    ...polarData.activities.map(a => ({ ...a, source: 'polar' }))
  ];

  // Ordenar por data
  allActivities.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    source: 'combined',
    count: allActivities.length,
    total_distance: garminData.total_distance + stravaData.total_distance + polarData.total_distance,
    total_duration: garminData.total_duration + stravaData.total_duration + polarData.total_duration,
    max_distance: Math.max(garminData.max_distance, stravaData.max_distance, polarData.max_distance),
    min_pace: Math.min(garminData.min_pace || Infinity, stravaData.min_pace || Infinity, polarData.min_pace || Infinity),
    activities: allActivities
  };
}

async function collectGarminData(supabase: any, userId: string) {
  const { data } = await supabase
    .from('garmin_activities')
    .select('*')
    .eq('user_id', userId)
    .order('start_time_in_seconds', { ascending: true });

  const activities = (data || []).map((activity: any) => ({
    date: activity.activity_date || new Date(activity.start_time_in_seconds * 1000).toISOString().split('T')[0],
    distance: activity.distance_in_meters || 0,
    duration: activity.duration_in_seconds || 0,
    pace: activity.average_pace_in_minutes_per_kilometer,
    start_time: activity.start_time_in_seconds,
    type: activity.activity_type
  }));

  return {
    total_distance: activities.reduce((sum: number, a: any) => sum + (a.distance || 0), 0),
    total_duration: activities.reduce((sum: number, a: any) => sum + (a.duration || 0), 0),
    max_distance: Math.max(...activities.map((a: any) => a.distance || 0), 0),
    min_pace: Math.min(...activities.map((a: any) => a.pace || Infinity).filter((p: number) => p > 0), Infinity),
    activities
  };
}

async function collectStravaData(supabase: any, userId: string) {
  const { data } = await supabase
    .from('strava_activities')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: true });

  const activities = (data || []).map((activity: any) => ({
    date: activity.start_date?.split('T')[0],
    distance: activity.distance || 0,
    duration: activity.moving_time || activity.elapsed_time || 0,
    pace: activity.average_speed ? (1000 / activity.average_speed) / 60 : null,
    start_time: new Date(activity.start_date).getTime() / 1000,
    type: activity.type
  }));

  return {
    total_distance: activities.reduce((sum: number, a: any) => sum + (a.distance || 0), 0),
    total_duration: activities.reduce((sum: number, a: any) => sum + (a.duration || 0), 0),
    max_distance: Math.max(...activities.map((a: any) => a.distance || 0), 0),
    min_pace: Math.min(...activities.map((a: any) => a.pace || Infinity).filter((p: number) => p > 0), Infinity),
    activities
  };
}

async function collectPolarData(supabase: any, userId: string) {
  const { data } = await supabase
    .from('polar_activities')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: true });

  const activities = (data || []).map((activity: any) => {
    let distance = 0;
    let duration = 0;

    if (activity.distance) {
      distance = parseFloat(activity.distance) * 1000; // Convert km to meters
    }

    if (activity.duration) {
      const durationMatch = activity.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1] || '0');
        const minutes = parseInt(durationMatch[2] || '0');
        const seconds = parseFloat(durationMatch[3] || '0');
        duration = hours * 3600 + minutes * 60 + seconds;
      }
    }

    return {
      date: activity.start_time?.split('T')[0],
      distance,
      duration,
      pace: duration && distance ? (duration / 60) / (distance / 1000) : null,
      start_time: new Date(activity.start_time).getTime() / 1000,
      type: activity.activity_type
    };
  });

  return {
    total_distance: activities.reduce((sum: number, a: any) => sum + (a.distance || 0), 0),
    total_duration: activities.reduce((sum: number, a: any) => sum + (a.duration || 0), 0),
    max_distance: Math.max(...activities.map((a: any) => a.distance || 0), 0),
    min_pace: Math.min(...activities.map((a: any) => a.pace || Infinity).filter((p: number) => p > 0), Infinity),
    activities
  };
}

async function checkAchievement(
  achievement: AchievementDefinition, 
  activityData: ActivityData,
  supabase: any,
  userId: string
): Promise<{ unlocked: boolean; progress: number; metadata?: any }> {
  
  switch (achievement.requirement_type) {
    case 'total_activities':
      return {
        unlocked: activityData.count >= achievement.requirement_value,
        progress: activityData.count
      };

    case 'total_distance':
      return {
        unlocked: activityData.total_distance >= achievement.requirement_value,
        progress: activityData.total_distance
      };

    case 'single_distance':
      return {
        unlocked: activityData.max_distance >= achievement.requirement_value,
        progress: activityData.max_distance
      };

    case 'activity_streak':
      const streak = calculateActivityStreak(activityData.activities);
      return {
        unlocked: streak >= achievement.requirement_value,
        progress: streak
      };

    case 'pace_achievement':
      const bestPace = activityData.min_pace;
      const targetPace = achievement.requirement_value; // minutes per km
      return {
        unlocked: bestPace !== Infinity && bestPace <= targetPace,
        progress: bestPace === Infinity ? 0 : Math.max(0, targetPace - bestPace + 1)
      };

    case 'early_activities':
      const earlyActivities = countEarlyActivities(activityData.activities);
      return {
        unlocked: earlyActivities >= achievement.requirement_value,
        progress: earlyActivities
      };

    case 'night_activities':
      const nightActivities = countNightActivities(activityData.activities);
      return {
        unlocked: nightActivities >= achievement.requirement_value,
        progress: nightActivities
      };

    default:
      return { unlocked: false, progress: 0 };
  }
}

function calculateActivityStreak(activities: any[]): number {
  if (activities.length === 0) return 0;

  const dates = [...new Set(activities.map(a => a.date))].sort();
  let currentStreak = 1;
  let maxStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

function countEarlyActivities(activities: any[]): number {
  return activities.filter(activity => {
    if (!activity.start_time) return false;
    const hour = new Date(activity.start_time * 1000).getHours();
    return hour < 7;
  }).length;
}

function countNightActivities(activities: any[]): number {
  return activities.filter(activity => {
    if (!activity.start_time) return false;
    const hour = new Date(activity.start_time * 1000).getHours();
    return hour >= 21;
  }).length;
}