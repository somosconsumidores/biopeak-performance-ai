import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strength workout types
type StrengthWorkoutType = 
  | 'functional_circuit'
  | 'max_strength'
  | 'muscular_endurance'
  | 'core_stability'
  | 'mobility'
  | 'plyometric'
  | 'unilateral';

// Exercise database by equipment and sport
const EXERCISES = {
  full_gym: {
    running: {
      lower: ['Agachamento', 'Leg Press', 'Afundo', 'Stiff', 'Elevação de Panturrilha', 'Step Up', 'Bulgarian Split Squat'],
      upper: ['Remada', 'Supino', 'Desenvolvimento', 'Puxada', 'Rosca Direta'],
      core: ['Prancha', 'Russian Twist', 'Abdominal Infra', 'Dead Bug', 'Pallof Press', 'Farmers Walk'],
      glutes: ['Hip Thrust', 'Abdução de Quadril', 'Glute Bridge', 'Cable Kickback'],
    },
    cycling: {
      lower: ['Leg Press', 'Agachamento', 'Extensora', 'Flexora', 'Panturrilha Sentado'],
      upper: ['Remada Baixa', 'Desenvolvimento', 'Face Pull'],
      core: ['Prancha', 'Prancha Lateral', 'Superman', 'Bird Dog'],
      glutes: ['Hip Thrust', 'Ponte de Glúteo', 'Abdução'],
    },
    swimming: {
      lower: ['Agachamento', 'Leg Press', 'Afundo Lateral'],
      upper: ['Puxada', 'Remada', 'Rotação Externa', 'Face Pull', 'Supino Inclinado'],
      core: ['Prancha', 'Rollout', 'Hanging Leg Raise', 'Cable Rotation'],
      shoulders: ['Desenvolvimento', 'Elevação Lateral', 'Rotação Interna/Externa'],
    },
  },
  home_basic: {
    running: {
      lower: ['Agachamento Livre', 'Afundo', 'Step Up (degrau)', 'Agachamento Unilateral', 'Panturrilha'],
      upper: ['Flexão', 'Remada com Halteres', 'Desenvolvimento com Halteres'],
      core: ['Prancha', 'Mountain Climber', 'Dead Bug', 'Bird Dog'],
      glutes: ['Ponte de Glúteo', 'Clamshell', 'Donkey Kick'],
    },
    cycling: {
      lower: ['Agachamento com Halteres', 'Afundo', 'Wall Sit', 'Panturrilha'],
      upper: ['Remada com Halteres', 'Flexão'],
      core: ['Prancha', 'Side Plank', 'Superman'],
      glutes: ['Ponte de Glúteo', 'Fire Hydrant'],
    },
    swimming: {
      lower: ['Agachamento', 'Afundo'],
      upper: ['Remada com Elástico', 'Flexão', 'Rotação com Elástico'],
      core: ['Prancha', 'Hollow Hold', 'V-Up'],
      shoulders: ['Elevação Lateral com Halteres', 'Face Pull com Elástico'],
    },
  },
  bodyweight: {
    running: {
      lower: ['Agachamento', 'Afundo', 'Step Up', 'Agachamento Búlgaro', 'Agachamento Pistol'],
      upper: ['Flexão', 'Flexão Diamante', 'Pike Push Up'],
      core: ['Prancha', 'Mountain Climber', 'Leg Raise', 'Flutter Kicks'],
      glutes: ['Ponte de Glúteo', 'Single Leg Bridge', 'Clamshell'],
    },
    cycling: {
      lower: ['Agachamento', 'Afundo', 'Wall Sit', 'Squat Jump'],
      upper: ['Flexão', 'Pike Push Up'],
      core: ['Prancha', 'Side Plank', 'Bicycle Crunch'],
      glutes: ['Ponte de Glúteo', 'Fire Hydrant'],
    },
    swimming: {
      lower: ['Agachamento', 'Squat Jump'],
      upper: ['Flexão', 'Pike Push Up', 'Supino no solo'],
      core: ['Prancha', 'Hollow Hold', 'Superman'],
      shoulders: ['Pike Push Up', 'Wall Angels'],
    },
  },
};

// Strength goal specific configurations
const GOAL_CONFIGS: Record<string, { focus: string[]; sets: number; reps: string; rest: string }> = {
  injury_prevention: {
    focus: ['core', 'glutes', 'unilateral'],
    sets: 3,
    reps: '12-15',
    rest: '60s',
  },
  performance: {
    focus: ['lower', 'upper', 'plyometric'],
    sets: 4,
    reps: '6-8',
    rest: '90s',
  },
  general: {
    focus: ['lower', 'upper', 'core'],
    sets: 3,
    reps: '10-12',
    rest: '60s',
  },
  core: {
    focus: ['core', 'glutes'],
    sets: 3,
    reps: '15-20 ou 30-45s',
    rest: '45s',
  },
};

function getMainSportFromPlan(parentPlan: any): 'running' | 'cycling' | 'swimming' {
  const sportType = parentPlan?.sport_type?.toLowerCase() || 'running';
  if (sportType.includes('cycl') || sportType.includes('bike')) return 'cycling';
  if (sportType.includes('swim') || sportType.includes('natacao')) return 'swimming';
  return 'running';
}

function generateStrengthWorkout(
  week: number,
  dayIndex: number,
  equipment: string,
  goal: string,
  mainSport: 'running' | 'cycling' | 'swimming',
  phase: 'base' | 'build' | 'peak' | 'taper'
): { title: string; description: string; workout_type: string; duration_minutes: number } {
  const config = GOAL_CONFIGS[goal] || GOAL_CONFIGS.general;
  const sportExercises = EXERCISES[equipment as keyof typeof EXERCISES]?.[mainSport] || EXERCISES.bodyweight.running;

  // Adjust workout based on phase
  let workoutType: StrengthWorkoutType;
  let phaseAdjustment = '';
  
  switch (phase) {
    case 'base':
      workoutType = 'muscular_endurance';
      phaseAdjustment = 'Fase BASE: Foco em resistência muscular e técnica.\n';
      break;
    case 'build':
      workoutType = goal === 'performance' ? 'max_strength' : 'functional_circuit';
      phaseAdjustment = 'Fase BUILD: Aumento progressivo de carga.\n';
      break;
    case 'peak':
      workoutType = goal === 'performance' ? 'plyometric' : 'functional_circuit';
      phaseAdjustment = 'Fase PEAK: Manutenção com intensidade.\n';
      break;
    case 'taper':
      workoutType = 'mobility';
      phaseAdjustment = 'Fase TAPER: Volume reduzido, foco em mobilidade.\n';
      break;
  }

  // Select exercises based on focus areas
  const selectedExercises: string[] = [];
  config.focus.forEach(area => {
    const areaExercises = sportExercises[area as keyof typeof sportExercises] || [];
    if (areaExercises.length > 0) {
      // Pick 2-3 random exercises from each focus area
      const shuffled = [...areaExercises].sort(() => Math.random() - 0.5);
      selectedExercises.push(...shuffled.slice(0, dayIndex === 0 ? 3 : 2));
    }
  });

  // Build description
  const exerciseList = selectedExercises
    .map((ex, i) => `${i + 1}. ${ex} - ${config.sets}x${config.reps}`)
    .join('\n');

  const warmup = `Aquecimento: 5-10min mobilidade articular + ativação muscular\n\n`;
  const cooldown = `\nVolta à calma: 5min alongamento dinâmico`;

  const sportSpecificTip = mainSport === 'running' 
    ? '\n💡 Dica: Foque em estabilidade de quadril e panturrilhas fortes.'
    : mainSport === 'cycling'
    ? '\n💡 Dica: Priorize quadríceps e core para melhor posição no pedal.'
    : '\n💡 Dica: Fortaleça ombros e dorsais para melhor propulsão na água.';

  const description = 
    phaseAdjustment +
    warmup +
    `Circuito Principal:\n${exerciseList}\n\nDescanso entre séries: ${config.rest}` +
    cooldown +
    sportSpecificTip;

  const title = `S${week} - Força ${dayIndex === 0 ? 'A' : 'B'}: ${
    goal === 'injury_prevention' ? 'Prevenção' :
    goal === 'performance' ? 'Performance' :
    goal === 'core' ? 'Core' : 'Geral'
  }`;

  const duration = phase === 'taper' ? 30 : phase === 'base' ? 40 : 45;

  return {
    title,
    description,
    workout_type: workoutType,
    duration_minutes: duration,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      planId,
      userId,
      strengthGoal = 'general',
      strengthEquipment = 'bodyweight',
      strengthFrequency = 2,
      parentPlanId,
      startDate,
      planDurationWeeks = 12,
    } = body;

    console.log('💪 Generating strength plan:', { planId, userId, strengthGoal, strengthEquipment, strengthFrequency, parentPlanId });

    // Fetch parent plan to determine main sport
    let parentPlan = null;
    let mainSport: 'running' | 'cycling' | 'swimming' = 'running';
    let parentWorkouts: any[] = [];

    if (parentPlanId) {
      const { data: parentData } = await supabase
        .from('training_plans')
        .select('*')
        .eq('id', parentPlanId)
        .single();
      
      parentPlan = parentData;
      mainSport = getMainSportFromPlan(parentPlan);

      // Fetch parent plan workouts to avoid scheduling conflicts
      const { data: parentWorkoutsData } = await supabase
        .from('training_plan_workouts')
        .select('workout_date, workout_type')
        .eq('plan_id', parentPlanId);
      
      parentWorkouts = parentWorkoutsData || [];
    }

    console.log(`Main sport: ${mainSport}, Parent workouts: ${parentWorkouts.length}`);

    // Identify high-intensity days from parent plan
    const highIntensityDays = new Set<string>();
    parentWorkouts.forEach(w => {
      const type = w.workout_type?.toLowerCase() || '';
      if (type.includes('interval') || type.includes('tempo') || type.includes('threshold') || 
          type.includes('sprint') || type.includes('race') || type.includes('limiar')) {
        highIntensityDays.add(w.workout_date);
      }
    });

    // Generate strength workouts
    const workouts: any[] = [];
    const start = new Date(startDate);

    // Day distribution: prefer rest days or easy days
    const preferredDays = [2, 4]; // Tuesday, Thursday as defaults
    
    for (let week = 1; week <= planDurationWeeks; week++) {
      // Determine phase
      const phase = week <= planDurationWeeks * 0.3 ? 'base'
        : week <= planDurationWeeks * 0.7 ? 'build'
        : week <= planDurationWeeks * 0.9 ? 'peak'
        : 'taper';

      // Cutback week: reduce frequency
      const isCutbackWeek = week % 4 === 0;
      const weekFrequency = isCutbackWeek ? Math.max(1, strengthFrequency - 1) : strengthFrequency;

      for (let dayIdx = 0; dayIdx < weekFrequency; dayIdx++) {
        // Calculate workout date
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
        
        // Try to find a good day (not high intensity)
        let attempts = 0;
        let workoutDate: Date;
        let dateStr: string;
        
        do {
          const targetDayIdx = preferredDays[(dayIdx + attempts) % preferredDays.length];
          workoutDate = new Date(weekStart);
          const baseDay = workoutDate.getDay();
          const diff = targetDayIdx - baseDay;
          workoutDate.setDate(workoutDate.getDate() + (diff >= 0 ? diff : 7 + diff));
          dateStr = workoutDate.toISOString().slice(0, 10);
          attempts++;
        } while (highIntensityDays.has(dateStr) && attempts < 7);

        const workout = generateStrengthWorkout(week, dayIdx, strengthEquipment, strengthGoal, mainSport, phase);

        workouts.push({
          user_id: userId,
          plan_id: planId,
          workout_date: dateStr,
          title: workout.title,
          description: workout.description,
          workout_type: workout.workout_type,
          target_pace_min_km: null,
          target_hr_zone: null,
          distance_meters: null,
          duration_minutes: workout.duration_minutes,
          status: 'planned',
        });
      }
    }

    console.log(`💪 Generated ${workouts.length} strength workouts`);

    // Insert workouts
    if (workouts.length > 0) {
      const { error: insertError } = await supabase
        .from('training_plan_workouts')
        .insert(workouts);

      if (insertError) {
        console.error('Error inserting strength workouts:', insertError);
        throw insertError;
      }
    }

    // Update plan status and link to parent
    const updateData: any = { 
      status: 'active',
      is_complementary: true,
    };
    
    if (parentPlanId) {
      updateData.parent_plan_id = parentPlanId;
    }

    const { error: updateError } = await supabase
      .from('training_plans')
      .update(updateData)
      .eq('id', planId);

    if (updateError) {
      console.error('Error updating plan status:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        workoutsGenerated: workouts.length,
        mainSport,
        phase: 'Started at base phase',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating strength plan:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
