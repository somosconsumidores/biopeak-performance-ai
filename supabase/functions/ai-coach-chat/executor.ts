// AI Coach Tool Executor - Executes tool calls against Supabase
// Handles all data fetching and mutations for the AI Coach

import { isActionTool } from "./tools.ts";

// ==================== QUERY EXECUTORS ====================

async function getLastActivity(supabase: any, userId: string, args: { activity_type?: string }) {
  let query = supabase
    .from('all_activities')
    .select('*')
    .eq('user_id', userId);
  
  if (args.activity_type) {
    query = query.eq('activity_type', args.activity_type);
  }
  
  const { data: activity, error } = await query
    .order('activity_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('Error in get_last_activity:', error);
    return { error: 'Falha ao buscar última atividade' };
  }
  
  if (!activity) {
    return { 
      found: false, 
      message: args.activity_type 
        ? `Nenhuma atividade do tipo ${args.activity_type} encontrada` 
        : 'Nenhuma atividade encontrada' 
    };
  }
  
  // Enrich with additional data
  const [variationData, hrZonesData] = await Promise.all([
    supabase
      .from('activity_variation_analysis')
      .select('*')
      .eq('activity_id', activity.activity_id)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('activity_heart_rate_zones')
      .select('*')
      .eq('activity_id', activity.activity_id)
      .eq('user_id', userId)
      .maybeSingle()
  ]);

  return {
    found: true,
    activity: {
      date: activity.activity_date,
      type: activity.activity_type,
      source: activity.activity_source,
      distance_km: activity.total_distance_meters ? (activity.total_distance_meters / 1000).toFixed(2) : null,
      duration_minutes: activity.total_time_minutes ? Math.round(activity.total_time_minutes) : null,
      pace_min_km: activity.pace_min_per_km ? Number(activity.pace_min_per_km).toFixed(2) : null,
      avg_heart_rate: activity.average_heart_rate,
      max_heart_rate: activity.max_heart_rate,
      calories: activity.active_kilocalories,
      elevation_gain: activity.total_elevation_gain_in_meters,
      elevation_loss: activity.total_elevation_loss_in_meters,
      detected_workout_type: activity.detected_workout_type,
      device: activity.device_name
    },
    variation_analysis: variationData.data ? {
      pace_cv: variationData.data.pace_cv,
      pace_category: variationData.data.pace_cv_category,
      hr_cv: variationData.data.heart_rate_cv,
      hr_category: variationData.data.heart_rate_cv_category,
      diagnosis: variationData.data.diagnosis
    } : null,
    hr_zones: hrZonesData.data ? {
      zone1_pct: hrZonesData.data.zone_1_percentage,
      zone2_pct: hrZonesData.data.zone_2_percentage,
      zone3_pct: hrZonesData.data.zone_3_percentage,
      zone4_pct: hrZonesData.data.zone_4_percentage,
      zone5_pct: hrZonesData.data.zone_5_percentage
    } : null
  };
}

async function getActivityByDate(supabase: any, userId: string, args: { date: string, activity_type?: string }) {
  let query = supabase
    .from('all_activities')
    .select('*')
    .eq('user_id', userId)
    .eq('activity_date', args.date);
  
  if (args.activity_type) {
    query = query.eq('activity_type', args.activity_type);
  }
  
  const { data: activities, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error in get_activity_by_date:', error);
    return { error: 'Falha ao buscar atividade' };
  }
  
  if (!activities || activities.length === 0) {
    return { 
      found: false, 
      date: args.date,
      message: `Nenhuma atividade encontrada em ${args.date}` 
    };
  }

  return {
    found: true,
    date: args.date,
    activities: activities.map((a: any) => ({
      type: a.activity_type,
      source: a.activity_source,
      distance_km: a.total_distance_meters ? (a.total_distance_meters / 1000).toFixed(2) : null,
      duration_minutes: a.total_time_minutes ? Math.round(a.total_time_minutes) : null,
      pace_min_km: a.pace_min_per_km ? Number(a.pace_min_per_km).toFixed(2) : null,
      avg_heart_rate: a.average_heart_rate,
      max_heart_rate: a.max_heart_rate,
      calories: a.active_kilocalories,
      elevation_gain: a.total_elevation_gain_in_meters
    }))
  };
}

async function getActivitiesRange(supabase: any, userId: string, args: { start_date: string, end_date: string, activity_type?: string }) {
  let query = supabase
    .from('all_activities')
    .select('activity_date, activity_type, total_distance_meters, total_time_minutes, pace_min_per_km, average_heart_rate, active_kilocalories')
    .eq('user_id', userId)
    .gte('activity_date', args.start_date)
    .lte('activity_date', args.end_date);
  
  if (args.activity_type) {
    query = query.eq('activity_type', args.activity_type);
  }
  
  const { data: activities, error } = await query.order('activity_date', { ascending: false });
  
  if (error) {
    console.error('Error in get_activities_range:', error);
    return { error: 'Falha ao buscar atividades do período' };
  }

  const totalDistance = activities?.reduce((sum: number, a: any) => sum + (a.total_distance_meters || 0), 0) || 0;
  const totalTime = activities?.reduce((sum: number, a: any) => sum + (a.total_time_minutes || 0), 0) || 0;
  const avgPace = activities?.filter((a: any) => a.pace_min_per_km).reduce((sum: number, a: any) => sum + Number(a.pace_min_per_km), 0) / (activities?.filter((a: any) => a.pace_min_per_km).length || 1);

  return {
    period: { start: args.start_date, end: args.end_date },
    total_activities: activities?.length || 0,
    summary: {
      total_distance_km: (totalDistance / 1000).toFixed(1),
      total_time_hours: (totalTime / 60).toFixed(1),
      average_pace_min_km: avgPace.toFixed(2)
    },
    activities: activities?.map((a: any) => ({
      date: a.activity_date,
      type: a.activity_type,
      distance_km: a.total_distance_meters ? (a.total_distance_meters / 1000).toFixed(2) : null,
      duration_minutes: a.total_time_minutes ? Math.round(a.total_time_minutes) : null,
      pace_min_km: a.pace_min_per_km ? Number(a.pace_min_per_km).toFixed(2) : null
    })) || []
  };
}

async function getTrainingPlan(supabase: any, userId: string) {
  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  
  if (planError || !plan) {
    return { found: false, message: 'Nenhum plano de treino ativo encontrado' };
  }

  const { data: workouts } = await supabase
    .from('training_plan_workouts')
    .select('id, workout_date, title, description, workout_type, status, distance_meters, duration_minutes, target_pace_min_km')
    .eq('plan_id', plan.id)
    .eq('user_id', userId)
    .order('workout_date', { ascending: true });

  const today = new Date().toISOString().split('T')[0];
  const upcomingWorkouts = workouts?.filter((w: any) => w.workout_date >= today && w.status === 'planned') || [];
  const completedWorkouts = workouts?.filter((w: any) => w.status === 'completed') || [];

  return {
    found: true,
    plan: {
      id: plan.id,
      name: plan.name || plan.plan_name,
      goal: plan.goal || plan.goal_type,
      start_date: plan.start_date,
      end_date: plan.end_date,
      duration_weeks: plan.duration_weeks
    },
    progress: {
      completed: completedWorkouts.length,
      total: workouts?.length || 0,
      completion_rate: workouts?.length ? ((completedWorkouts.length / workouts.length) * 100).toFixed(1) + '%' : '0%'
    },
    upcoming_workouts: upcomingWorkouts.slice(0, 7).map((w: any) => ({
      id: w.id,
      date: w.workout_date,
      title: w.title,
      type: w.workout_type,
      description: w.description,
      distance_km: w.distance_meters ? (w.distance_meters / 1000).toFixed(1) : null,
      duration_min: w.duration_minutes,
      target_pace: w.target_pace_min_km
    })),
    today_workout: upcomingWorkouts.find((w: any) => w.workout_date === today) || null
  };
}

async function getSleepData(supabase: any, userId: string, args: { days?: number }) {
  const days = Math.min(args.days || 7, 30);
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  const { data: sleepRecords, error } = await supabase
    .from('garmin_sleep_summaries')
    .select('calendar_date, sleep_score, sleep_time_in_seconds, deep_sleep_duration_in_seconds, rem_sleep_duration_in_seconds, light_sleep_duration_in_seconds, awake_duration_in_seconds')
    .eq('user_id', userId)
    .gte('calendar_date', dateThreshold.toISOString().split('T')[0])
    .order('calendar_date', { ascending: false });

  if (error || !sleepRecords || sleepRecords.length === 0) {
    return { found: false, message: 'Nenhum dado de sono encontrado' };
  }

  const avgScore = sleepRecords.reduce((sum: number, s: any) => sum + (s.sleep_score || 0), 0) / sleepRecords.length;
  const avgTime = sleepRecords.reduce((sum: number, s: any) => sum + (s.sleep_time_in_seconds || 0), 0) / sleepRecords.length;

  return {
    found: true,
    days_analyzed: sleepRecords.length,
    summary: {
      avg_sleep_score: Math.round(avgScore),
      avg_sleep_hours: (avgTime / 3600).toFixed(1)
    },
    recent_nights: sleepRecords.slice(0, 7).map((s: any) => ({
      date: s.calendar_date,
      score: s.sleep_score,
      total_hours: s.sleep_time_in_seconds ? (s.sleep_time_in_seconds / 3600).toFixed(1) : null,
      deep_hours: s.deep_sleep_duration_in_seconds ? (s.deep_sleep_duration_in_seconds / 3600).toFixed(1) : null,
      rem_hours: s.rem_sleep_duration_in_seconds ? (s.rem_sleep_duration_in_seconds / 3600).toFixed(1) : null
    }))
  };
}

async function getFitnessScores(supabase: any, userId: string, args: { days?: number }) {
  const days = args.days || 14;
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  const { data: fitnessData, error } = await supabase
    .from('fitness_scores_daily')
    .select('calendar_date, fitness_score, ctl_42day, atl_7day, daily_strain, capacity_score, consistency_score, recovery_balance_score')
    .eq('user_id', userId)
    .gte('calendar_date', dateThreshold.toISOString().split('T')[0])
    .order('calendar_date', { ascending: false });

  if (error || !fitnessData || fitnessData.length === 0) {
    return { found: false, message: 'Nenhum dado de fitness encontrado' };
  }

  const latest = fitnessData[0];
  const tsb = latest.ctl_42day && latest.atl_7day ? (latest.ctl_42day - latest.atl_7day) : null;

  return {
    found: true,
    current: {
      date: latest.calendar_date,
      fitness_score: latest.fitness_score?.toFixed(1),
      ctl_chronic_load: latest.ctl_42day?.toFixed(1),
      atl_acute_load: latest.atl_7day?.toFixed(1),
      tsb_freshness: tsb?.toFixed(1),
      daily_strain: latest.daily_strain?.toFixed(0),
      capacity_score: latest.capacity_score?.toFixed(1),
      consistency_score: latest.consistency_score?.toFixed(1),
      recovery_score: latest.recovery_balance_score?.toFixed(1)
    },
    interpretation: {
      form: tsb && tsb > 10 ? 'Fresh - pronto para esforço intenso' :
            tsb && tsb > 0 ? 'Boa forma - balanceado' :
            tsb && tsb > -10 ? 'Fadiga leve - recuperação adequada' :
            tsb ? 'Fadiga alta - priorizar recuperação' : 'Dados insuficientes'
    },
    trend: fitnessData.slice(0, 7).map((f: any) => ({
      date: f.calendar_date,
      ctl: f.ctl_42day?.toFixed(1),
      atl: f.atl_7day?.toFixed(1)
    }))
  };
}

async function getUserProfile(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !profile) {
    return { found: false, message: 'Perfil não encontrado' };
  }

  const age = profile.birth_date ? 
    Math.floor((new Date().getTime() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  return {
    found: true,
    name: profile.display_name || profile.first_name,
    age,
    weight_kg: profile.weight_kg,
    height_cm: profile.height_cm,
    vo2_max: profile.vo2_max,
    resting_hr: profile.resting_heart_rate,
    max_hr: profile.max_heart_rate,
    member_since: profile.created_at
  };
}

async function getUserGoals(supabase: any, userId: string) {
  const { data: goals, error } = await supabase
    .from('user_commitments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !goals || goals.length === 0) {
    return { found: false, message: 'Nenhum objetivo registrado' };
  }

  return {
    found: true,
    goals: goals.map((g: any) => ({
      description: g.goal_description || g.commitment_text,
      target_date: g.target_date,
      status: g.status,
      created_at: g.created_at
    }))
  };
}

async function compareActivities(supabase: any, userId: string, args: { activity_ids?: string[], start_date?: string, end_date?: string, activity_type?: string }) {
  let activities: any[] = [];

  if (args.activity_ids && args.activity_ids.length > 0) {
    const { data } = await supabase
      .from('all_activities')
      .select('*')
      .eq('user_id', userId)
      .in('activity_id', args.activity_ids);
    activities = data || [];
  } else if (args.start_date && args.end_date) {
    let query = supabase
      .from('all_activities')
      .select('*')
      .eq('user_id', userId)
      .gte('activity_date', args.start_date)
      .lte('activity_date', args.end_date);
    
    if (args.activity_type) {
      query = query.eq('activity_type', args.activity_type);
    }
    
    const { data } = await query.order('activity_date', { ascending: true });
    activities = data || [];
  }

  if (activities.length < 2) {
    return { error: 'Precisa de pelo menos 2 atividades para comparar' };
  }

  const paces = activities.filter(a => a.pace_min_per_km).map(a => Number(a.pace_min_per_km));
  const hrs = activities.filter(a => a.average_heart_rate).map(a => a.average_heart_rate);

  return {
    activities_compared: activities.length,
    comparison: activities.map((a: any) => ({
      date: a.activity_date,
      type: a.activity_type,
      distance_km: a.total_distance_meters ? (a.total_distance_meters / 1000).toFixed(2) : null,
      pace_min_km: a.pace_min_per_km ? Number(a.pace_min_per_km).toFixed(2) : null,
      avg_hr: a.average_heart_rate
    })),
    evolution: {
      pace_improvement: paces.length >= 2 ? (paces[0] - paces[paces.length - 1]).toFixed(2) + ' min/km' : null,
      hr_trend: hrs.length >= 2 ? (hrs[0] > hrs[hrs.length - 1] ? 'melhorando' : 'estável') : null
    }
  };
}

// ==================== ACTION EXECUTORS ====================

async function rescheduleWorkout(supabase: any, userId: string, args: { from_date: string, to_date: string, strategy?: string }) {
  // Get active plan
  const { data: plan } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!plan) {
    return { success: false, error: 'Nenhum plano de treino ativo encontrado' };
  }

  const COACH_KEY = Deno.env.get('COACH_EDGE_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  // Call the dedicated reschedule function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/coach-reschedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-coach-key': COACH_KEY || ''
    },
    body: JSON.stringify({
      user_id: userId,
      plan_id: plan.id,
      from_date: args.from_date,
      to_date: args.to_date,
      strategy: args.strategy || 'replace'
    })
  });

  const result = await response.json();
  
  if (!response.ok) {
    return { success: false, error: result.error || result.message || 'Falha ao reagendar treino' };
  }

  return {
    success: true,
    message: result.message || 'Treino reagendado com sucesso',
    moved_workout: result.moved_workout,
    conflicts: result.conflicts
  };
}

async function createCustomWorkout(supabase: any, userId: string, args: { 
  date: string, 
  workout_type: string, 
  title: string, 
  description: string,
  duration_minutes?: number,
  distance_meters?: number,
  target_pace_min_km?: number,
  notes?: string 
}) {
  // Get active plan
  const { data: plan } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!plan) {
    return { success: false, error: 'Nenhum plano de treino ativo. Crie um plano primeiro.' };
  }

  const { data: workout, error } = await supabase
    .from('training_plan_workouts')
    .insert({
      plan_id: plan.id,
      user_id: userId,
      workout_date: args.date,
      workout_type: args.workout_type,
      title: args.title,
      description: args.description,
      duration_minutes: args.duration_minutes,
      distance_meters: args.distance_meters,
      target_pace_min_km: args.target_pace_min_km,
      notes: args.notes,
      status: 'planned',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating workout:', error);
    return { success: false, error: 'Falha ao criar treino: ' + error.message };
  }

  return {
    success: true,
    message: `Treino "${args.title}" criado para ${args.date}`,
    workout: {
      id: workout.id,
      date: workout.workout_date,
      title: workout.title,
      type: workout.workout_type
    }
  };
}

async function markWorkoutComplete(supabase: any, userId: string, args: { workout_date: string, notes?: string, perceived_effort?: number }) {
  const { data: workout, error: findError } = await supabase
    .from('training_plan_workouts')
    .select('id, title')
    .eq('user_id', userId)
    .eq('workout_date', args.workout_date)
    .eq('status', 'planned')
    .maybeSingle();

  if (findError || !workout) {
    return { success: false, error: `Nenhum treino planejado encontrado em ${args.workout_date}` };
  }

  const { error: updateError } = await supabase
    .from('training_plan_workouts')
    .update({
      status: 'completed',
      notes: args.notes,
      perceived_effort: args.perceived_effort,
      updated_at: new Date().toISOString()
    })
    .eq('id', workout.id);

  if (updateError) {
    return { success: false, error: 'Falha ao atualizar treino' };
  }

  return {
    success: true,
    message: `Treino "${workout.title}" marcado como concluído! 🎉`,
    workout_id: workout.id
  };
}

async function skipWorkout(supabase: any, userId: string, args: { workout_date: string, reason: string, notes?: string }) {
  const { data: workout, error: findError } = await supabase
    .from('training_plan_workouts')
    .select('id, title')
    .eq('user_id', userId)
    .eq('workout_date', args.workout_date)
    .eq('status', 'planned')
    .maybeSingle();

  if (findError || !workout) {
    return { success: false, error: `Nenhum treino planejado encontrado em ${args.workout_date}` };
  }

  const { error: updateError } = await supabase
    .from('training_plan_workouts')
    .update({
      status: 'skipped',
      notes: `[Motivo: ${args.reason}] ${args.notes || ''}`,
      updated_at: new Date().toISOString()
    })
    .eq('id', workout.id);

  if (updateError) {
    return { success: false, error: 'Falha ao pular treino' };
  }

  return {
    success: true,
    message: `Treino "${workout.title}" pulado. Lembre-se de manter a consistência quando possível!`,
    workout_id: workout.id,
    reason: args.reason
  };
}

// ==================== MAIN EXECUTOR ====================

export async function executeToolCall(
  toolName: string, 
  args: any, 
  supabase: any, 
  userId: string
): Promise<{ result: any; isAction: boolean }> {
  console.log(`[Tool Executor] Executing: ${toolName}`, args);
  
  let result: any;
  const isAction = isActionTool(toolName);
  
  try {
    switch (toolName) {
      // Query tools
      case 'get_last_activity':
        result = await getLastActivity(supabase, userId, args);
        break;
      case 'get_activity_by_date':
        result = await getActivityByDate(supabase, userId, args);
        break;
      case 'get_activities_range':
        result = await getActivitiesRange(supabase, userId, args);
        break;
      case 'get_training_plan':
        result = await getTrainingPlan(supabase, userId);
        break;
      case 'get_sleep_data':
        result = await getSleepData(supabase, userId, args);
        break;
      case 'get_fitness_scores':
        result = await getFitnessScores(supabase, userId, args);
        break;
      case 'get_user_profile':
        result = await getUserProfile(supabase, userId);
        break;
      case 'get_user_goals':
        result = await getUserGoals(supabase, userId);
        break;
      case 'compare_activities':
        result = await compareActivities(supabase, userId, args);
        break;
      
      // Action tools
      case 'reschedule_workout':
        result = await rescheduleWorkout(supabase, userId, args);
        break;
      case 'create_custom_workout':
        result = await createCustomWorkout(supabase, userId, args);
        break;
      case 'mark_workout_complete':
        result = await markWorkoutComplete(supabase, userId, args);
        break;
      case 'skip_workout':
        result = await skipWorkout(supabase, userId, args);
        break;
      
      default:
        result = { error: `Tool desconhecida: ${toolName}` };
    }
  } catch (error) {
    console.error(`[Tool Executor] Error in ${toolName}:`, error);
    result = { error: `Erro ao executar ${toolName}: ${error.message}` };
  }

  console.log(`[Tool Executor] Result for ${toolName}:`, JSON.stringify(result).slice(0, 200));
  
  return { result, isAction };
}
