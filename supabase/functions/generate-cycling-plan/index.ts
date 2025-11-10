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

interface WorkoutTemplate {
  type: string;
  name: string;
  description: string;
  structure: any[];
  tssPerHour: number;
  baseMinDuration?: number;
  progressionPerWeek?: number;
  variationIndex?: number;
}

type MesocycleFocus = 'base' | 'build' | 'peak' | 'taper' | 'recovery';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData: CyclingPlanRequest = await req.json();

    console.log('🚴 Generating enhanced cycling plan for:', requestData.planId);

    // ==========================================
    // 1. INTELLIGENT FTP ESTIMATION
    // ==========================================
    let ftp = requestData.ftpWatts;
    let ftpConfidence: 'user' | 'calculated' | 'estimated' = 'user';

    if (!ftp) {
      // Try to calculate FTP from recent best 20min effort
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentActivities } = await supabase
        .from('all_activities')
        .select('total_distance_meters, total_time_minutes, activity_type')
        .eq('user_id', requestData.userId)
        .eq('activity_source', 'garmin')
        .in('activity_type', ['cycling', 'indoor_cycling', 'virtual_ride'])
        .gte('activity_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('activity_date', { ascending: false });

      let calculatedFTP: number | null = null;

      if (recentActivities && recentActivities.length > 0) {
        // Find best 20-minute power estimate from activities
        let bestPower20min = 0;
        
        for (const activity of recentActivities) {
          if (activity.total_time_minutes >= 20 && activity.total_distance_meters > 0) {
            // Rough power estimate from speed (this is a proxy, not exact)
            const avgSpeedMs = activity.total_distance_meters / (activity.total_time_minutes * 60);
            // Estimate power = 0.5 * air_density * frontal_area * drag_coef * speed^3 + weight * grade * speed
            // Simplified: power ≈ k * speed^2.5 (for flat terrain)
            const estimatedPower = Math.round(80 * Math.pow(avgSpeedMs, 2.5));
            
            if (estimatedPower > bestPower20min && estimatedPower < 500) { // sanity check
              bestPower20min = estimatedPower;
            }
          }
        }

        if (bestPower20min > 100) {
          calculatedFTP = Math.round(bestPower20min * 0.95); // 20min to FTP conversion
          ftpConfidence = 'calculated';
          console.log(`✅ Calculated FTP from recent activities: ${calculatedFTP}W`);
        }
      }

      // Fall back to weight-based estimation if calculation failed
      if (!calculatedFTP) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('weight_kg')
          .eq('id', requestData.userId)
          .single();

        const baseWattsPerKg = requestData.level === 'beginner' ? 2.0 
          : requestData.level === 'intermediate' ? 2.8 
          : 3.5;

        ftp = Math.round((profile?.weight_kg || 75) * baseWattsPerKg);
        ftpConfidence = 'estimated';
        console.log(`⚠️ Estimated FTP: ${ftp}W (${baseWattsPerKg}W/kg)`);
      } else {
        ftp = calculatedFTP;
      }
    }

    console.log(`🎯 Final FTP: ${ftp}W (confidence: ${ftpConfidence})`);

    // ==========================================
    // 2. CALCULATE POWER ZONES
    // ==========================================
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

    // Save power zones with confidence level
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

    // ==========================================
    // 3. DEFINE MESOCYCLE BLOCKS
    // ==========================================
    const getMesocycleFocus = (week: number): MesocycleFocus => {
      const weekMod = (week - 1) % 12; // 12-week cycle
      
      if (weekMod < 3) return 'base';       // Weeks 1-3
      if (weekMod === 3) return 'recovery';  // Week 4
      if (weekMod < 7) return 'build';       // Weeks 5-7
      if (weekMod === 7) return 'recovery';  // Week 8
      if (weekMod < 11) return 'peak';       // Weeks 9-11
      return 'taper';                        // Week 12
    };

    // ==========================================
    // 4. CALCULATE ENHANCED WEEKLY TSS
    // ==========================================
    const baseTSS = requestData.level === 'beginner' ? 250 
      : requestData.level === 'intermediate' ? 450 
      : 650;

    const weeklyTSS: number[] = [];
    for (let week = 1; week <= requestData.planDurationWeeks; week++) {
      const focus = getMesocycleFocus(week);
      let tss: number;
      
      if (focus === 'recovery') {
        tss = Math.round(baseTSS * 0.6);
      } else if (focus === 'taper') {
        tss = Math.round(baseTSS * 0.5);
      } else if (focus === 'base') {
        // Base: conservative progression (4% per week)
        const baseWeek = ((week - 1) % 12) + 1;
        tss = Math.round(baseTSS * (1 + (baseWeek - 1) * 0.04));
      } else if (focus === 'build') {
        // Build: aggressive progression (8% per week)
        const buildWeek = ((week - 5) % 12) + 1;
        tss = Math.round(baseTSS * 1.12 * (1 + buildWeek * 0.08));
      } else {
        // Peak: maintain peak (2% per week)
        const peakWeek = ((week - 9) % 12) + 1;
        tss = Math.round(baseTSS * 1.32 * (1 + peakWeek * 0.02));
      }
      
      weeklyTSS.push(tss);
    }

    console.log('📈 Weekly TSS progression:', weeklyTSS);

    // ==========================================
    // 5. DEFINE WORKOUT VARIATIONS
    // ==========================================
    
    // Sweet Spot Variations
    const sweetSpotVariations = [
      { intervals: 3, duration: 15, rest: 5, name: 'Classic 3x15' },
      { intervals: 4, duration: 12, rest: 4, name: 'Dense 4x12' },
      { intervals: 2, duration: 20, rest: 7, name: 'Long 2x20' },
      { intervals: 5, duration: 10, rest: 3, name: 'Short 5x10' },
    ];

    // Threshold Variations
    const thresholdVariations = [
      { intervals: 3, duration: 10, rest: 5, name: 'Standard 3x10' },
      { intervals: 4, duration: 8, rest: 4, name: 'Compact 4x8' },
      { intervals: 2, duration: 15, rest: 6, name: 'Extended 2x15' },
      { intervals: 5, duration: 6, rest: 3, name: 'Micro 5x6' },
    ];

    // ==========================================
    // 6. GENERATE ENHANCED WORKOUT TEMPLATES
    // ==========================================
    const generateWorkoutTemplates = (week: number): WorkoutTemplate[] => {
      const focus = getMesocycleFocus(week);
      const ssVariation = sweetSpotVariations[week % sweetSpotVariations.length];
      const thrVariation = thresholdVariations[week % thresholdVariations.length];

      const templates: WorkoutTemplate[] = [
        // Recovery
        {
          type: 'recovery',
          name: 'Recovery Spin',
          description: 'Easy recovery ride in Zone 1',
          structure: [
            { phase: 'main', zone: 'Z1', duration: 45, power: Math.round((zones.z1_min + zones.z1_max) / 2) },
          ],
          tssPerHour: 30,
        },
        
        // Endurance Base
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

        // Sweet Spot with rotation
        {
          type: 'sweet_spot',
          name: `Sweet Spot ${ssVariation.name}`,
          description: 'Intervals at 88-93% FTP (upper Z3/lower Z4)',
          structure: [
            { phase: 'warmup', zone: 'Z1-Z2', duration: 15, power: zones.z2_min },
            { 
              phase: 'interval', 
              zone: 'Z3/Z4', 
              duration: ssVariation.duration, 
              power: Math.round(ftp * 0.90), 
              intervals: ssVariation.intervals, 
              rest: ssVariation.rest 
            },
            { phase: 'cooldown', zone: 'Z1', duration: 10, power: zones.z1_max },
          ],
          tssPerHour: 85,
          variationIndex: week % sweetSpotVariations.length,
        },

        // Threshold with rotation
        {
          type: 'threshold',
          name: `Threshold ${thrVariation.name}`,
          description: 'FTP intervals in Zone 4',
          structure: [
            { phase: 'warmup', zone: 'Z1-Z2', duration: 15, power: zones.z2_min },
            { 
              phase: 'interval', 
              zone: 'Z4', 
              duration: thrVariation.duration, 
              power: ftp, 
              intervals: thrVariation.intervals, 
              rest: thrVariation.rest 
            },
            { phase: 'cooldown', zone: 'Z1', duration: 10, power: zones.z1_max },
          ],
          tssPerHour: 95,
          variationIndex: week % thresholdVariations.length,
        },

        // VO2Max
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

        // Over-Under Intervals (NEW)
        {
          type: 'over_under',
          name: 'Over/Under Intervals',
          description: 'Alternating above and below FTP',
          structure: [
            { phase: 'warmup', zone: 'Z1-Z2', duration: 15, power: zones.z2_min },
            { 
              phase: 'interval', 
              zone: 'Z4-Z5', 
              duration: 12, 
              intervals: 3,
              rest: 5,
              description: '2min @ 105% FTP, 2min @ 95% FTP (repeat 3x)',
              power: ftp
            },
            { phase: 'cooldown', zone: 'Z1', duration: 10, power: zones.z1_max },
          ],
          tssPerHour: 100,
        },

        // Sprint Intervals (NEW - Z6 utilization)
        {
          type: 'sprint',
          name: 'Sprint Intervals',
          description: 'Short high-power sprints for neuromuscular development',
          structure: [
            { phase: 'warmup', zone: 'Z1-Z2', duration: 20, power: zones.z2_min },
            { 
              phase: 'interval', 
              zone: 'Z6', 
              duration: 0.5, 
              power: Math.round(ftp * 1.30), 
              intervals: 8, 
              rest: 4,
              description: '30s sprint máximo, 4min recuperação'
            },
            { phase: 'cooldown', zone: 'Z1', duration: 15, power: zones.z1_max },
          ],
          tssPerHour: 70,
        },

        // High Cadence Drills (NEW)
        {
          type: 'high_cadence',
          name: 'High Cadence Drills',
          description: 'Cadence work at 100-110 RPM in Z2-Z3',
          structure: [
            { phase: 'warmup', zone: 'Z1', duration: 10, power: zones.z1_max, cadence: 'easy' },
            { 
              phase: 'interval', 
              zone: 'Z2', 
              duration: 5, 
              power: zones.z2_max, 
              intervals: 6, 
              rest: 3, 
              cadence: '100-110 RPM' 
            },
            { phase: 'cooldown', zone: 'Z1', duration: 10, power: zones.z1_max },
          ],
          tssPerHour: 55,
        },

        // Low Cadence Strength (NEW)
        {
          type: 'strength',
          name: 'Low Cadence Strength',
          description: 'Force development at 50-60 RPM',
          structure: [
            { phase: 'warmup', zone: 'Z1-Z2', duration: 20, power: zones.z2_min },
            { 
              phase: 'interval', 
              zone: 'Z3', 
              duration: 5, 
              intervals: 6, 
              rest: 3,
              power: zones.z3_max,
              cadence: '50-60 RPM',
              description: 'Subida simulada com cadência baixa'
            },
            { phase: 'cooldown', zone: 'Z1', duration: 15, power: zones.z1_max },
          ],
          tssPerHour: 70,
        },
      ];

      // Add Long Ride with progression (NEW)
      const longRideDuration = Math.min(90 + (week * 15), 210); // Progress from 90min to 3h30
      templates.push({
        type: 'long_endurance',
        name: 'Long Ride',
        description: `Treino longo de resistência aeróbica (${Math.round(longRideDuration / 60)}h${longRideDuration % 60}min)`,
        structure: [
          { phase: 'warmup', zone: 'Z1', duration: 15, power: zones.z1_max },
          { phase: 'main', zone: 'Z2', duration: longRideDuration - 50, power: Math.round((zones.z2_min + zones.z2_max) / 2) },
          { phase: 'tempo', zone: 'Z3', duration: 20, power: Math.round((zones.z3_min + zones.z3_max) / 2) },
          { phase: 'cooldown', zone: 'Z1', duration: 15, power: zones.z1_max },
        ],
        tssPerHour: 65,
        baseMinDuration: 90,
        progressionPerWeek: 15,
      });

      // Add Long Brick Ride for peak weeks (NEW)
      if (focus === 'peak' && requestData.level !== 'beginner') {
        templates.push({
          type: 'long_brick',
          name: 'Long Ride + Tempo Bricks',
          description: 'Treino longo com blocos de intensidade moderada',
          structure: [
            { phase: 'warmup', zone: 'Z1', duration: 15, power: zones.z1_max },
            { phase: 'endurance', zone: 'Z2', duration: 60, power: zones.z2_max },
            { phase: 'brick', zone: 'Z3', duration: 15, intervals: 2, rest: 15, power: Math.round((zones.z3_min + zones.z3_max) / 2) },
            { phase: 'endurance', zone: 'Z2', duration: 30, power: zones.z2_max },
            { phase: 'cooldown', zone: 'Z1', duration: 10, power: zones.z1_max },
          ],
          tssPerHour: 70,
        });
      }

      // Add Event Simulation for Gran Fondo (NEW)
      if (focus === 'peak' && requestData.goal === 'cycling_gran_fondo') {
        templates.push({
          type: 'event_simulation',
          name: 'Gran Fondo Simulation',
          description: 'Simulação de prova: ritmo constante com subidas',
          structure: [
            { phase: 'warmup', zone: 'Z1-Z2', duration: 20, power: zones.z2_min },
            { phase: 'steady', zone: 'Z2-Z3', duration: 90, power: Math.round((zones.z2_max + zones.z3_min) / 2), description: 'Ritmo de prova constante' },
            { phase: 'climb_sim', zone: 'Z3-Z4', duration: 15, intervals: 2, rest: 10, power: zones.z3_max, description: 'Simulação de subidas' },
            { phase: 'steady', zone: 'Z2', duration: 30, power: zones.z2_max },
            { phase: 'cooldown', zone: 'Z1', duration: 15, power: zones.z1_max },
          ],
          tssPerHour: 75,
        });
      }

      return templates;
    };

    // ==========================================
    // 7. GENERATE WEEKLY WORKOUT DISTRIBUTION
    // ==========================================
    const workouts: any[] = [];
    const startDate = new Date(requestData.startDate);
    const daysPerWeek = requestData.availableDays.length;

    for (let week = 0; week < requestData.planDurationWeeks; week++) {
      const weekNumber = week + 1;
      const focus = getMesocycleFocus(weekNumber);
      const targetTSS = weeklyTSS[week];
      const templates = generateWorkoutTemplates(weekNumber);
      
      // Determine workout distribution based on mesocycle focus
      const weekWorkouts: WorkoutTemplate[] = [];

      if (focus === 'recovery') {
        // Recovery week: easy rides only
        for (let i = 0; i < Math.min(3, daysPerWeek); i++) {
          weekWorkouts.push(templates.find(w => w.type === 'recovery')!);
        }
      } else if (focus === 'taper') {
        // Taper week: maintain intensity, reduce volume
        weekWorkouts.push(templates.find(w => w.type === 'endurance')!);
        weekWorkouts.push(templates.find(w => w.type === 'threshold')!);
        if (daysPerWeek >= 3) weekWorkouts.push(templates.find(w => w.type === 'recovery')!);
      } else if (focus === 'base') {
        // Base phase: high volume, low intensity
        weekWorkouts.push(templates.find(w => w.type === 'endurance')!);
        weekWorkouts.push(templates.find(w => w.type === 'endurance')!);
        weekWorkouts.push(templates.find(w => w.type === 'sweet_spot')!);
        if (daysPerWeek >= 4) weekWorkouts.push(templates.find(w => w.type === 'high_cadence')!);
        if (daysPerWeek >= 5) weekWorkouts.push(templates.find(w => w.type === 'long_endurance')!);
      } else if (focus === 'build') {
        // Build phase: increasing intensity
        weekWorkouts.push(templates.find(w => w.type === 'endurance')!);
        weekWorkouts.push(templates.find(w => w.type === 'sweet_spot')!);
        weekWorkouts.push(templates.find(w => w.type === 'threshold')!);
        if (daysPerWeek >= 4) {
          weekWorkouts.push(requestData.level === 'advanced' 
            ? templates.find(w => w.type === 'over_under')!
            : templates.find(w => w.type === 'vo2max')!
          );
        }
        if (daysPerWeek >= 5) weekWorkouts.push(templates.find(w => w.type === 'strength')!);
        if (daysPerWeek >= 6) weekWorkouts.push(templates.find(w => w.type === 'long_endurance')!);
      } else if (focus === 'peak') {
        // Peak phase: race-specific training
        weekWorkouts.push(templates.find(w => w.type === 'endurance')!);
        weekWorkouts.push(templates.find(w => w.type === 'threshold')!);
        
        if (requestData.level === 'advanced') {
          weekWorkouts.push(templates.find(w => w.type === 'sprint')!);
        } else {
          weekWorkouts.push(templates.find(w => w.type === 'vo2max')!);
        }

        if (daysPerWeek >= 4) {
          const eventSim = templates.find(w => w.type === 'event_simulation');
          if (eventSim) {
            weekWorkouts.push(eventSim);
          } else {
            weekWorkouts.push(templates.find(w => w.type === 'long_brick')!);
          }
        }
        
        if (daysPerWeek >= 5) weekWorkouts.push(templates.find(w => w.type === 'recovery')!);
      }

      // Polarized training for advanced athletes (alternating weeks in build phase)
      if (requestData.level === 'advanced' && focus === 'build' && weekNumber % 2 === 1) {
        // Polarized week: 80% Z1-Z2, 20% Z4-Z5
        weekWorkouts.length = 0;
        weekWorkouts.push(templates.find(w => w.type === 'endurance')!);
        weekWorkouts.push(templates.find(w => w.type === 'vo2max')!);
        weekWorkouts.push(templates.find(w => w.type === 'endurance')!);
        weekWorkouts.push(templates.find(w => w.type === 'threshold')!);
        if (daysPerWeek >= 5) weekWorkouts.push(templates.find(w => w.type === 'long_endurance')!);
        console.log(`⚡ Week ${weekNumber}: Polarized training`);
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

        // Calculate workout date
        const dayOffset = requestData.availableDays.indexOf(requestData.availableDays[dayIndex % daysPerWeek]);
        const workoutDate = new Date(startDate);
        workoutDate.setDate(workoutDate.getDate() + (week * 7) + dayOffset);

        // Build enhanced workout description
        let description = template.description + '\n\n';
        
        template.structure.forEach((phase: any) => {
          if (phase.intervals) {
            const intervalDesc = phase.description || `${phase.intervals}x ${phase.duration}min @ ${phase.power}W (${phase.zone})`;
            description += intervalDesc;
            if (phase.cadence) description += ` - Cadência: ${phase.cadence}`;
            if (phase.rest) description += ` com ${phase.rest}min de recuperação`;
            description += '\n';
          } else {
            description += `${phase.phase}: ${phase.duration}min @ ${phase.power}W (${phase.zone})`;
            if (phase.cadence) description += ` - Cadência: ${phase.cadence}`;
            if (phase.description) description += ` - ${phase.description}`;
            description += '\n';
          }
        });
        
        description += `\n📊 TSS estimado: ${workoutTSS}`;
        description += `\n🎯 Foco da semana: ${focus}`;

        workouts.push({
          plan_id: requestData.planId,
          user_id: requestData.userId,
          workout_date: workoutDate.toISOString().split('T')[0],
          title: template.name,
          description: description.trim(),
          workout_type: template.type,
          duration_minutes: totalDuration,
          target_hr_zone: template.structure[1]?.zone || 'Z2',
        });
      }

      console.log(`📅 Week ${weekNumber} (${focus}): ${weekWorkouts.length} workouts`);
    }

    // ==========================================
    // 8. SAVE WORKOUTS TO DATABASE
    // ==========================================
    const { error: workoutsError } = await supabase
      .from('training_plan_workouts')
      .insert(workouts);

    if (workoutsError) {
      console.error('Error saving workouts:', workoutsError);
      throw workoutsError;
    }

    // ==========================================
    // 9. UPDATE TRAINING PLAN STATUS
    // ==========================================
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

    console.log(`✅ Successfully generated ${workouts.length} enhanced workouts for cycling plan ${requestData.planId}`);
    console.log(`🎯 FTP: ${ftp}W (${ftpConfidence})`);
    console.log(`📊 Total TSS range: ${Math.min(...weeklyTSS)} - ${Math.max(...weeklyTSS)}`);

    return new Response(
      JSON.stringify({
        success: true,
        planId: requestData.planId,
        workoutsGenerated: workouts.length,
        ftp: ftp,
        ftpConfidence: ftpConfidence,
        zones: zones,
        weeklyTSS: weeklyTSS,
        features: {
          intelligentFTP: true,
          z6Training: true,
          intervalVariations: true,
          longRidesProgressive: true,
          mesocycles: true,
          strengthTraining: true,
          eventSimulation: requestData.goal === 'cycling_gran_fondo',
          polarization: requestData.level === 'advanced',
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error generating cycling plan:', error);
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
