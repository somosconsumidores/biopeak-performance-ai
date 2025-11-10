import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CyclingPlanRequest {
  planId: string;
  userId: string;
  goal: string;
  level: string;
  ftpWatts?: number;
  maxHeartRate?: number;
  availableHoursPerWeek: number;
  availableDays: string[];
  equipmentType: string;
  startDate: string;
  planDurationWeeks: number;
  targetEventDate?: string;
  targetEventDescription?: string;
}

interface PowerZones {
  z1_min: number;
  z1_max: number;
  z2_min: number;
  z2_max: number;
  z3_min: number;
  z3_max: number;
  z4_min: number;
  z4_max: number;
  z5_min: number;
  z5_max: number;
  z6_min: number;
  z6_max: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData: CyclingPlanRequest = await req.json();

    console.log('Generating cycling plan for:', requestData.planId);

    // 1. Estimate FTP if not provided
    let ftp = requestData.ftpWatts;
    if (!ftp) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('weight_kg')
        .eq('id', requestData.userId)
        .single();

      const baseWattsPerKg = requestData.level === 'beginner' ? 2.0 
        : requestData.level === 'intermediate' ? 2.8 
        : 3.5;

      ftp = Math.round((profile?.weight_kg || 75) * baseWattsPerKg);
      console.log(`Estimated FTP: ${ftp}W (${baseWattsPerKg}W/kg)`);
    }

    // 2. Calculate Power Zones
    const zones: PowerZones = {
      z1_min: 0,
      z1_max: Math.round(ftp * 0.55),
      z2_min: Math.round(ftp * 0.56),
      z2_max: Math.round(ftp * 0.75),
      z3_min: Math.round(ftp * 0.76),
      z3_max: Math.round(ftp * 0.90),
      z4_min: Math.round(ftp * 0.91),
      z4_max: Math.round(ftp * 1.05),
      z5_min: Math.round(ftp * 1.06),
      z5_max: Math.round(ftp * 1.20),
      z6_min: Math.round(ftp * 1.21),
      z6_max: Math.round(ftp * 1.50),
    };

    // 3. Save power zones to database
    const { error: zonesError } = await supabase
      .from('cycling_power_zones')
      .insert({
        user_id: requestData.userId,
        plan_id: requestData.planId,
        ftp_watts: ftp,
        ...zones,
      });

    if (zonesError) {
      console.error('Error saving power zones:', zonesError);
      throw zonesError;
    }

    // 4. Calculate weekly TSS progression
    const baseTSS = requestData.level === 'beginner' ? 200 
      : requestData.level === 'intermediate' ? 350 
      : 500;

    const weeklyTSS: number[] = [];
    for (let week = 1; week <= requestData.planDurationWeeks; week++) {
      let tss: number;
      
      // Recovery weeks (every 4 weeks)
      if (week % 4 === 0) {
        tss = Math.round(baseTSS * 0.6);
      }
      // Taper weeks (last 2 weeks before event)
      else if (requestData.targetEventDate && week > requestData.planDurationWeeks - 2) {
        const taperFactor = week === requestData.planDurationWeeks ? 0.5 : 0.7;
        tss = Math.round(baseTSS * (1 + (week - 1) * 0.06) * taperFactor);
      }
      // Progressive build
      else {
        tss = Math.round(baseTSS * (1 + (week - 1) * 0.06));
      }
      
      weeklyTSS.push(tss);
    }

    console.log('Weekly TSS progression:', weeklyTSS);

    // 5. Generate workout templates
    const workoutTemplates = [
      {
        type: 'endurance',
        name: 'Endurance Ride',
        description: 'Base aerobic ride in Zone 2',
        structure: [
          { phase: 'warmup', zone: 'Z1', duration: 10, power: zones.z1_max },
          { phase: 'main', zone: 'Z2', duration: 60, power: Math.round((zones.z2_min + zones.z2_max) / 2) },
          { phase: 'cooldown', zone: 'Z1', duration: 10, power: zones.z1_max },
        ],
        tssPerHour: 60,
      },
      {
        type: 'sweet_spot',
        name: 'Sweet Spot Intervals',
        description: 'Intervals at 88-93% FTP (upper Z3/lower Z4)',
        structure: [
          { phase: 'warmup', zone: 'Z1-Z2', duration: 15, power: zones.z2_min },
          { phase: 'interval', zone: 'Z3/Z4', duration: 15, power: Math.round(ftp * 0.90), intervals: 3, rest: 5 },
          { phase: 'cooldown', zone: 'Z1', duration: 10, power: zones.z1_max },
        ],
        tssPerHour: 85,
      },
      {
        type: 'threshold',
        name: 'Threshold Intervals',
        description: 'FTP intervals in Zone 4',
        structure: [
          { phase: 'warmup', zone: 'Z1-Z2', duration: 15, power: zones.z2_min },
          { phase: 'interval', zone: 'Z4', duration: 10, power: ftp, intervals: 3, rest: 5 },
          { phase: 'cooldown', zone: 'Z1', duration: 10, power: zones.z1_max },
        ],
        tssPerHour: 95,
      },
      {
        type: 'vo2max',
        name: 'VO2Max Intervals',
        description: 'High intensity intervals in Zone 5',
        structure: [
          { phase: 'warmup', zone: 'Z1-Z2', duration: 20, power: zones.z2_min },
          { phase: 'interval', zone: 'Z5', duration: 3, power: Math.round(ftp * 1.10), intervals: 6, rest: 3 },
          { phase: 'cooldown', zone: 'Z1', duration: 15, power: zones.z1_max },
        ],
        tssPerHour: 85,
      },
      {
        type: 'recovery',
        name: 'Recovery Spin',
        description: 'Easy recovery ride in Zone 1',
        structure: [
          { phase: 'main', zone: 'Z1', duration: 45, power: Math.round((zones.z1_min + zones.z1_max) / 2) },
        ],
        tssPerHour: 30,
      },
    ];

    // 6. Generate workouts for each week
    const workouts: any[] = [];
    const startDate = new Date(requestData.startDate);
    const daysPerWeek = requestData.availableDays.length;

    for (let week = 0; week < requestData.planDurationWeeks; week++) {
      const targetTSS = weeklyTSS[week];
      const isRecoveryWeek = (week + 1) % 4 === 0;
      
      // Distribute workouts across available days
      let tssAllocated = 0;
      const weekWorkouts: any[] = [];

      // Plan workout types for the week
      if (isRecoveryWeek) {
        // Recovery week: mostly easy rides
        for (let day = 0; day < Math.min(3, daysPerWeek); day++) {
          weekWorkouts.push(workoutTemplates.find(w => w.type === 'recovery'));
        }
      } else {
        // Build week: mix of workouts
        if (daysPerWeek >= 4) {
          weekWorkouts.push(workoutTemplates.find(w => w.type === 'endurance'));
          weekWorkouts.push(workoutTemplates.find(w => w.type === 'sweet_spot'));
          weekWorkouts.push(workoutTemplates.find(w => w.type === 'threshold'));
          if (daysPerWeek >= 5) weekWorkouts.push(workoutTemplates.find(w => w.type === 'endurance'));
          if (daysPerWeek >= 6) weekWorkouts.push(workoutTemplates.find(w => w.type === 'vo2max'));
        } else if (daysPerWeek === 3) {
          weekWorkouts.push(workoutTemplates.find(w => w.type === 'endurance'));
          weekWorkouts.push(workoutTemplates.find(w => w.type === 'sweet_spot'));
          weekWorkouts.push(workoutTemplates.find(w => w.type === 'threshold'));
        }
      }

      // Create workout records
      for (let dayIndex = 0; dayIndex < weekWorkouts.length; dayIndex++) {
        const template = weekWorkouts[dayIndex];
        if (!template) continue;

        const totalDuration = template.structure.reduce((sum: number, phase: any) => {
          if (phase.intervals) {
            return sum + (phase.duration * phase.intervals) + (phase.rest * (phase.intervals - 1));
          }
          return sum + phase.duration;
        }, 0);

        const workoutTSS = Math.round((template.tssPerHour / 60) * totalDuration);
        tssAllocated += workoutTSS;

        // Calculate workout date
        const dayOffset = requestData.availableDays.indexOf(requestData.availableDays[dayIndex % daysPerWeek]);
        const workoutDate = new Date(startDate);
        workoutDate.setDate(workoutDate.getDate() + (week * 7) + dayOffset);

        // Build workout description with intervals
        let description = template.description + '\n\n';
        template.structure.forEach((phase: any) => {
          if (phase.intervals) {
            description += `${phase.intervals}x ${phase.duration}min @ ${phase.power}W (${phase.zone}) com ${phase.rest}min de recuperação\n`;
          } else {
            description += `${phase.phase}: ${phase.duration}min @ ${phase.power}W (${phase.zone})\n`;
          }
        });
        description += `\nTSS estimado: ${workoutTSS}`;

        workouts.push({
          plan_id: requestData.planId,
          user_id: requestData.userId,
          workout_date: workoutDate.toISOString().split('T')[0],
          title: template.name,
          description: description.trim(),
          workout_type: template.type,
          duration_minutes: totalDuration,
          target_hr_zone: template.structure[1]?.zone || 'Z2', // Store main zone
        });
      }

      console.log(`Week ${week + 1}: ${weekWorkouts.length} workouts, ${tssAllocated} TSS (target: ${targetTSS})`);
    }

    // 7. Save workouts to database
    const { error: workoutsError } = await supabase
      .from('training_plan_workouts')
      .insert(workouts);

    if (workoutsError) {
      console.error('Error saving workouts:', workoutsError);
      throw workoutsError;
    }

    // 8. Update training plan status
    const { error: planError } = await supabase
      .from('training_plans')
      .update({
        status: 'active',
        generated_at: new Date().toISOString(),
        ftp_watts: ftp,
      })
      .eq('id', requestData.planId);

    if (planError) {
      console.error('Error updating plan:', planError);
      throw planError;
    }

    console.log(`Successfully generated ${workouts.length} workouts for cycling plan ${requestData.planId}`);

    return new Response(
      JSON.stringify({
        success: true,
        planId: requestData.planId,
        workoutsGenerated: workouts.length,
        ftp: ftp,
        zones: zones,
        weeklyTSS: weeklyTSS,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating cycling plan:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
