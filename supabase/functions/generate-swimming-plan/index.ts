import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Swimming workout types
type SwimmingWorkoutType = 
  | 'warmup'
  | 'technique'
  | 'aerobic'
  | 'threshold'
  | 'interval'
  | 'sprint'
  | 'mixed'
  | 'recovery'
  | 'test';

interface SwimmingWorkout {
  type: SwimmingWorkoutType;
  title: string;
  description: string;
  distance_meters: number;
  duration_minutes: number;
  target_css_zone: number; // 1-5
  week: number;
  weekday: string;
}

// CSS Zones (based on Critical Swim Speed)
// Z1: CSS + 15s/100m (Recovery)
// Z2: CSS + 10s/100m (Aerobic)
// Z3: CSS + 5s/100m (Tempo)
// Z4: CSS (Threshold)
// Z5: CSS - 5s/100m (VO2max)

function calculateCSSZones(cssSecondsPerHundred: number) {
  return {
    z1: cssSecondsPerHundred + 15,
    z2: cssSecondsPerHundred + 10,
    z3: cssSecondsPerHundred + 5,
    z4: cssSecondsPerHundred,
    z5: cssSecondsPerHundred - 5,
  };
}

function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/100m`;
}

function generateWorkoutDescription(
  workout: SwimmingWorkout, 
  cssZones: ReturnType<typeof calculateCSSZones>,
  poolLength: number,
  equipment: string[]
): string {
  const zone = cssZones[`z${workout.target_css_zone}` as keyof typeof cssZones];
  const paceStr = formatPace(zone);
  
  const equipmentStr = equipment.length > 0 
    ? `\nEquipamentos sugeridos: ${equipment.join(', ')}`
    : '';

  switch (workout.type) {
    case 'warmup':
      return `Aquecimento ${workout.distance_meters}m variado.\n200m nado livre leve + 4x50m técnico (${poolLength}m) + 100m pernas.${equipmentStr}`;
    
    case 'technique':
      return `Treino técnico focado em eficiência.\n${workout.distance_meters}m total com drills de braçada, rotação de tronco e posição corporal.\nRitmo: ${paceStr} (Z${workout.target_css_zone})${equipmentStr}`;
    
    case 'aerobic':
      const sets = Math.floor(workout.distance_meters / 400);
      return `Treino aeróbico contínuo.\n${sets}x400m nado livre em Z${workout.target_css_zone} (${paceStr}).\nDescanso: 30s entre séries.${equipmentStr}`;
    
    case 'threshold':
      const thresholdSets = Math.floor(workout.distance_meters / 200);
      return `Treino de limiar (CSS).\n${thresholdSets}x200m em ritmo Z${workout.target_css_zone} (${paceStr}).\nDescanso: 20s entre séries.${equipmentStr}`;
    
    case 'interval':
      const intervalSets = Math.floor(workout.distance_meters / 100);
      return `Treino intervalado.\n${intervalSets}x100m em Z${workout.target_css_zone} (${paceStr}).\nDescanso: 15s entre séries. Foco em manter ritmo constante.${equipmentStr}`;
    
    case 'sprint':
      const sprintSets = Math.floor(workout.distance_meters / 50);
      return `Treino de velocidade.\n${sprintSets}x50m sprint máximo.\nDescanso: 45s entre séries. Foco em explosão e frequência de braçada.${equipmentStr}`;
    
    case 'mixed':
      return `Treino misto multi-estilos.\n${workout.distance_meters}m alternando crawl, costas e peito.\nRitmo: ${paceStr} (Z${workout.target_css_zone})${equipmentStr}`;
    
    case 'recovery':
      return `Recuperação ativa.\n${workout.distance_meters}m nado livre muito leve em Z1.\nFoco em relaxamento e técnica. Opcional: usar snorkel.${equipmentStr}`;
    
    case 'test':
      return `Teste de CSS.\nAquecimento 400m + Teste: 400m all-out + 5min descanso + 200m all-out.\nAnote seus tempos para calcular o novo CSS.`;
    
    default:
      return `${workout.distance_meters}m de natação. Ritmo: ${paceStr}${equipmentStr}`;
  }
}

function getWorkoutTitle(type: SwimmingWorkoutType, week: number): string {
  const titles: Record<SwimmingWorkoutType, string> = {
    warmup: 'Aquecimento',
    technique: 'Técnica de Natação',
    aerobic: 'Aeróbico Contínuo',
    threshold: 'Treino de Limiar',
    interval: 'Intervalado',
    sprint: 'Velocidade',
    mixed: 'Multi-estilos',
    recovery: 'Recuperação Ativa',
    test: 'Teste de CSS',
  };
  return `S${week} - ${titles[type]}`;
}

// Generate weekly structure based on available hours
function generateWeeklyStructure(
  availableHours: number,
  level: string,
  weekNumber: number,
  totalWeeks: number
): SwimmingWorkoutType[] {
  // Base structure by available hours
  let structure: SwimmingWorkoutType[] = [];
  
  // Periodization: increase intensity over weeks
  const phase = weekNumber <= totalWeeks * 0.4 ? 'base' 
              : weekNumber <= totalWeeks * 0.7 ? 'build' 
              : weekNumber <= totalWeeks * 0.9 ? 'peak' 
              : 'taper';
  
  // Cutback week every 4 weeks
  const isCutbackWeek = weekNumber % 4 === 0;
  
  if (availableHours <= 3) {
    // 2-3 sessions per week
    structure = isCutbackWeek 
      ? ['recovery', 'technique']
      : phase === 'base' ? ['technique', 'aerobic']
      : phase === 'build' ? ['aerobic', 'threshold']
      : phase === 'peak' ? ['threshold', 'interval']
      : ['recovery', 'technique'];
  } else if (availableHours <= 5) {
    // 3-4 sessions per week
    structure = isCutbackWeek
      ? ['recovery', 'technique', 'aerobic']
      : phase === 'base' ? ['technique', 'aerobic', 'aerobic']
      : phase === 'build' ? ['technique', 'aerobic', 'threshold']
      : phase === 'peak' ? ['aerobic', 'threshold', 'interval']
      : ['recovery', 'technique', 'aerobic'];
  } else {
    // 4-5 sessions per week
    structure = isCutbackWeek
      ? ['recovery', 'technique', 'aerobic', 'recovery']
      : phase === 'base' ? ['technique', 'aerobic', 'aerobic', 'mixed']
      : phase === 'build' ? ['technique', 'aerobic', 'threshold', 'interval']
      : phase === 'peak' ? ['aerobic', 'threshold', 'interval', 'sprint']
      : ['recovery', 'technique', 'aerobic', 'recovery'];
  }
  
  // Add CSS test every 4 weeks (not on cutback)
  if (weekNumber % 4 === 1 && weekNumber > 1 && !isCutbackWeek) {
    structure[0] = 'test';
  }
  
  return structure;
}

// Calculate distance based on level and workout type
function calculateWorkoutDistance(
  type: SwimmingWorkoutType,
  level: string,
  weekNumber: number,
  isCutbackWeek: boolean
): number {
  const baseDistances: Record<string, Record<SwimmingWorkoutType, number>> = {
    beginner: {
      warmup: 400,
      technique: 800,
      aerobic: 1200,
      threshold: 800,
      interval: 600,
      sprint: 400,
      mixed: 1000,
      recovery: 600,
      test: 1000,
    },
    intermediate: {
      warmup: 500,
      technique: 1200,
      aerobic: 2000,
      threshold: 1500,
      interval: 1200,
      sprint: 800,
      mixed: 1500,
      recovery: 800,
      test: 1200,
    },
    advanced: {
      warmup: 600,
      technique: 1500,
      aerobic: 3000,
      threshold: 2000,
      interval: 1800,
      sprint: 1200,
      mixed: 2000,
      recovery: 1000,
      test: 1500,
    },
  };
  
  const base = baseDistances[level]?.[type] || 1000;
  
  // Progressive increase (up to 20% over plan duration)
  const progressFactor = 1 + (weekNumber * 0.02);
  
  // Cutback reduction
  const cutbackFactor = isCutbackWeek ? 0.7 : 1;
  
  return Math.round(base * progressFactor * cutbackFactor / 100) * 100; // Round to nearest 100m
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
      goal,
      level = 'intermediate',
      cssSecondsPerHundred,
      poolLength = 25,
      availableHoursPerWeek = 4,
      availableDays = ['monday', 'wednesday', 'friday'],
      swimmingEquipment = [],
      startDate,
      planDurationWeeks = 12,
    } = body;

    console.log('🏊 Generating swimming plan:', { planId, userId, goal, level, cssSecondsPerHundred });

    // Default CSS if not provided (based on level)
    const defaultCSS: Record<string, number> = {
      beginner: 150, // 2:30/100m
      intermediate: 120, // 2:00/100m
      advanced: 95, // 1:35/100m
    };
    
    const css = cssSecondsPerHundred || defaultCSS[level] || 120;
    const cssZones = calculateCSSZones(css);
    
    console.log('CSS Zones:', cssZones);

    // Day index mapping
    const dayToIndex: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };

    const availableDayIndices = availableDays.map((d: string) => dayToIndex[d.toLowerCase()] ?? 1);

    // Generate workouts for each week
    const workouts: any[] = [];
    const start = new Date(startDate);

    for (let week = 1; week <= planDurationWeeks; week++) {
      const isCutbackWeek = week % 4 === 0;
      const weeklyStructure = generateWeeklyStructure(
        availableHoursPerWeek,
        level,
        week,
        planDurationWeeks
      );

      // Distribute workouts across available days
      weeklyStructure.forEach((workoutType, idx) => {
        const dayIdx = availableDayIndices[idx % availableDayIndices.length];
        
        // Calculate workout date
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
        const baseDay = weekStart.getDay();
        const diff = dayIdx - baseDay;
        const workoutDate = new Date(weekStart);
        workoutDate.setDate(workoutDate.getDate() + (diff >= 0 ? diff : 7 + diff));

        const distance = calculateWorkoutDistance(workoutType, level, week, isCutbackWeek);
        const duration = Math.round(distance / (level === 'advanced' ? 40 : level === 'intermediate' ? 35 : 30)); // meters per minute

        const targetZone = workoutType === 'recovery' ? 1
          : workoutType === 'aerobic' ? 2
          : workoutType === 'technique' ? 2
          : workoutType === 'threshold' ? 4
          : workoutType === 'interval' ? 4
          : workoutType === 'sprint' ? 5
          : 3;

        const swimmingWorkout: SwimmingWorkout = {
          type: workoutType,
          title: getWorkoutTitle(workoutType, week),
          description: '',
          distance_meters: distance,
          duration_minutes: duration,
          target_css_zone: targetZone,
          week,
          weekday: availableDays[idx % availableDays.length],
        };

        swimmingWorkout.description = generateWorkoutDescription(
          swimmingWorkout,
          cssZones,
          poolLength,
          swimmingEquipment
        );

        workouts.push({
          user_id: userId,
          plan_id: planId,
          workout_date: workoutDate.toISOString().slice(0, 10),
          title: swimmingWorkout.title,
          description: swimmingWorkout.description,
          workout_type: workoutType,
          target_pace_min_km: css / 60, // Convert to min/100m as a proxy
          target_hr_zone: `Z${targetZone}`,
          distance_meters: distance,
          duration_minutes: duration,
          status: 'planned',
        });
      });
    }

    console.log(`🏊 Generated ${workouts.length} swimming workouts`);

    // Insert workouts
    if (workouts.length > 0) {
      const { error: insertError } = await supabase
        .from('training_plan_workouts')
        .insert(workouts);

      if (insertError) {
        console.error('Error inserting swimming workouts:', insertError);
        throw insertError;
      }
    }

    // Update plan status to active
    const { error: updateError } = await supabase
      .from('training_plans')
      .update({ status: 'active' })
      .eq('id', planId);

    if (updateError) {
      console.error('Error updating plan status:', updateError);
      throw updateError;
    }

    // Store CSS zones for the plan
    const { error: zonesError } = await supabase
      .from('swimming_css_zones')
      .upsert({
        user_id: userId,
        plan_id: planId,
        css_seconds_per_100m: css,
        z1_seconds: cssZones.z1,
        z2_seconds: cssZones.z2,
        z3_seconds: cssZones.z3,
        z4_seconds: cssZones.z4,
        z5_seconds: cssZones.z5,
      }, { onConflict: 'plan_id' });

    if (zonesError) {
      console.log('Note: Could not store CSS zones (table may not exist):', zonesError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        workoutsGenerated: workouts.length,
        cssZones,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating swimming plan:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
