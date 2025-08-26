import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utilities
const dayToIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateForWeekday(startDate: Date, weekNumber: number, weekdayIdx: number) {
  // Week 1 starts at startDate. We advance (weekNumber-1)*7 days, then adjust to desired weekday.
  const base = addDays(startDate, (weekNumber - 1) * 7);
  const baseIdx = base.getUTCDay(); // 0-6 (Sun-Sat)
  const diff = weekdayIdx - baseIdx;
  return addDays(base, diff >= 0 ? diff : diff);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve user from token (required to validate ownership)
    const { data: userResult } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userResult?.user;
    if (!user) throw new Error("Invalid auth token");

    const body = await req.json().catch(() => ({}));
    const planId: string | undefined = body.plan_id;
    if (!planId) throw new Error("plan_id is required");

    console.log(`🚀 generate-training-plan start for plan ${planId}`);

    // Fetch plan
    const { data: plan, error: planErr } = await supabase
      .from("training_plans")
      .select("id, user_id, plan_name, goal_type, start_date, end_date, weeks, target_event_date, status")
      .eq("id", planId)
      .maybeSingle();

    if (planErr || !plan) throw new Error("Plan not found");
    if (plan.user_id !== user.id) throw new Error("Not authorized to generate this plan");

    // Fetch preferences
    const { data: prefs } = await supabase
      .from("training_plan_preferences")
      .select("days_per_week, days_of_week, long_run_weekday, start_date")
      .eq("plan_id", planId)
      .maybeSingle();

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, birth_date, weight_kg, height_cm, gender")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch recent unified activities (last 180 days)
    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - 180);
    const sinceStr = sinceDate.toISOString().slice(0, 10);

    const { data: activities } = await supabase
      .from("all_activities")
      .select("activity_date,total_distance_meters,total_time_minutes,pace_min_per_km,average_heart_rate,max_heart_rate,activity_type")
      .eq("user_id", user.id)
      .gte("activity_date", sinceStr)
      .order("activity_date", { ascending: false });

    // ================================
    // SAFETY CALIBRATOR - CRITICAL FOR ATHLETE HEALTH
    // ================================
    
    class SafetyCalibrator {
      private runs: any[];
      private profile: any;
      
      constructor(runs: any[], profile: any) {
        this.runs = runs;
        this.profile = profile;
      }
      
      // Filter valid running data for pace analysis
      private getValidRunData() {
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // Last 90 days
        
        return this.runs.filter((run: any) => {
          const pace = Number(run.pace_min_per_km);
          const distance = Number(run.total_distance_meters || 0) / 1000;
          const duration = Number(run.total_time_minutes || 0);
          const activityDate = new Date(run.activity_date);
          
          // Safety filters: realistic paces and meaningful activities
          return (
            pace > 0 && pace < 12 && // Pace between 1:00/km and 12:00/km (realistic range)
            distance >= 2 && distance <= 50 && // Distance between 2km and 50km
            duration >= 10 && // At least 10 minutes
            activityDate >= cutoffDate && // Recent data
            Number.isFinite(pace) &&
            Number.isFinite(distance) &&
            Number.isFinite(duration)
          );
        });
      }
      
      // Calculate safe baseline paces using conservative methods
      private calculateSafeBaselines() {
        const validRuns = this.getValidRunData();
        
        if (validRuns.length < 3) {
          console.log("⚠️ Insufficient data - using conservative defaults");
          return this.getConservativeDefaults();
        }
        
        // Sort paces and use median-based approach for stability
        const paces = validRuns.map((r: any) => Number(r.pace_min_per_km)).sort((a, b) => a - b);
        const median = paces[Math.floor(paces.length / 2)];
        const best = paces[0]; // Fastest pace
        const p75 = paces[Math.floor(paces.length * 0.75)]; // 75th percentile (conservative baseline)
        
        console.log(`📊 Pace analysis: best=${best.toFixed(2)}, median=${median.toFixed(2)}, p75=${p75.toFixed(2)}`);
        
        // Use Riegel formula with conservative baseline (median rather than best)
        const safeBasePace = median; // Use median for safety
        const base5kTimeMin = safeBasePace * 5;
        
        const riegel = (baseTimeMin: number, baseDistKm: number, targetDistKm: number) => {
          return baseTimeMin * Math.pow(targetDistKm / baseDistKm, 1.06);
        };
        
        return {
          pace_5k: safeBasePace,
          pace_10k: riegel(base5kTimeMin, 5, 10) / 10,
          pace_half_marathon: riegel(base5kTimeMin, 5, 21.0975) / 21.0975,
          pace_marathon: riegel(base5kTimeMin, 5, 42.195) / 42.195,
          // Conservative training paces
          pace_easy: Math.max(safeBasePace * 1.4, p75), // At least 40% slower or P75
          pace_tempo: riegel(base5kTimeMin, 5, 10) / 10, // 10k pace for tempo
          pace_threshold: safeBasePace * 1.15, // 15% slower than 5k
          pace_interval_400m: Math.max(safeBasePace * 0.97, best), // Not faster than best observed
          pace_interval_800m: safeBasePace * 1.02, // Slightly slower than 5k
          pace_interval_1km: safeBasePace * 1.05, // 5% slower than 5k
        };
      }
      
      // Conservative defaults when insufficient data
      private getConservativeDefaults() {
        const age = this.profile?.birth_date ? 
          Math.floor((Date.now() - new Date(this.profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 35;
        
        // Age-adjusted conservative paces for beginner-intermediate runners
        const basePace = age < 25 ? 5.5 : age < 35 ? 6.0 : age < 45 ? 6.5 : 7.0;
        
        console.log(`⚠️ Using age-adjusted defaults (age: ${age}, base: ${basePace.toFixed(2)}/km)`);
        
        return {
          pace_5k: basePace,
          pace_10k: basePace * 1.08,
          pace_half_marathon: basePace * 1.15,
          pace_marathon: basePace * 1.25,
          pace_easy: basePace * 1.5, // Very conservative for safety
          pace_tempo: basePace * 1.08, // 10k pace
          pace_threshold: basePace * 1.05,
          pace_interval_400m: basePace * 0.98,
          pace_interval_800m: basePace * 1.02,
          pace_interval_1km: basePace * 1.05,
        };
      }
      
      // Apply safety clamps to any pace
      public applySafetyClamps(type: string, pace: number, duration?: number): { pace: number; warnings: string[] } {
        const baselines = this.calculateSafeBaselines();
        const warnings: string[] = [];
        let safePace = pace;
        
        // Critical safety rules by workout type
        switch (type.toLowerCase()) {
          case 'easy':
          case 'recovery':
          case 'base':
            // Easy runs must be significantly slower than threshold paces
            const minEasyPace = Math.max(baselines.pace_10k + 0.45, baselines.pace_easy);
            if (pace < minEasyPace) {
              safePace = minEasyPace;
              warnings.push(`⚠️ Easy pace adjusted from ${pace.toFixed(2)} to ${safePace.toFixed(2)} for safety`);
            }
            break;
            
          case 'long_run':
          case 'long':
            // Long runs must be in aerobic zone (never faster than 10k pace)
            const minLongPace = Math.max(baselines.pace_10k + 0.30, baselines.pace_easy);
            if (pace < minLongPace) {
              safePace = minLongPace;
              warnings.push(`⚠️ Long run pace adjusted from ${pace.toFixed(2)} to ${safePace.toFixed(2)} for safety`);
            }
            break;
            
          case 'tempo':
          case 'threshold':
            // Tempo runs should not be faster than 10k pace
            const minTempoPace = baselines.pace_10k;
            const maxTempoDuration = 45; // Max 45 minutes for tempo
            
            if (pace < minTempoPace) {
              safePace = minTempoPace;
              warnings.push(`⚠️ Tempo pace adjusted from ${pace.toFixed(2)} to ${safePace.toFixed(2)} - too fast for sustained effort`);
            }
            
            if (duration && duration > maxTempoDuration) {
              warnings.push(`⚠️ Tempo duration ${duration}min exceeds safe limit of ${maxTempoDuration}min`);
            }
            break;
            
          case 'interval':
            // Intervals should not be faster than best observed pace
            const minIntervalPace = baselines.pace_interval_400m;
            if (pace < minIntervalPace) {
              safePace = minIntervalPace;
              warnings.push(`⚠️ Interval pace adjusted from ${pace.toFixed(2)} to ${safePace.toFixed(2)} - exceeds current fitness`);
            }
            break;
        }
        
        // Universal safety bounds
        if (safePace < 3.0) {
          safePace = 3.0;
          warnings.push(`🚨 CRITICAL: Pace was dangerously fast (<3:00/km), set to minimum safe pace`);
        }
        
        if (safePace > 12.0) {
          safePace = 8.0;
          warnings.push(`⚠️ Pace was unrealistically slow (>12:00/km), adjusted to reasonable pace`);
        }
        
        return { pace: safePace, warnings };
      }
      
      // Get safe target paces for plan generation
      public getSafeTargetPaces() {
        return this.calculateSafeBaselines();
      }
    }
    
    // Initialize Safety Calibrator
    const runs = (activities || []).filter((a) => (a.activity_type || "").toLowerCase().includes("run"));
    const safetyCalibrator = new SafetyCalibrator(runs, profile);
    const safeTargetPaces = safetyCalibrator.getSafeTargetPaces();
    
    console.log("🛡️ Safe target paces calculated:", safeTargetPaces);
    
    // Calculate aggregated stats for context (but use safe paces for training)
    const paces = runs.map((r: any) => Number(r.pace_min_per_km)).filter((v) => Number.isFinite(v) && v > 0);
    const bestPace = paces.length ? Math.min(...paces) : null;
    const avgPace = paces.length ? paces.reduce((s, v) => s + v, 0) / paces.length : null;
    const avgHrVals = runs.map((r: any) => Number(r.average_heart_rate)).filter((v) => Number.isFinite(v) && v > 0);
    const avgHr = avgHrVals.length ? Math.round(avgHrVals.reduce((s, v) => s + v, 0) / avgHrVals.length) : null;
    const maxHrVals = runs.map((r: any) => Number(r.max_heart_rate)).filter((v) => Number.isFinite(v) && v > 0);
    const observedMaxHr = maxHrVals.length ? Math.max(...maxHrVals) : null;

    // Weekly patterns
    const byWeek = new Map<string, { count: number; distance: number }>();
    runs.forEach((r: any) => {
      const d = new Date(r.activity_date);
      const year = d.getUTCFullYear();
      const week = Math.ceil(((+d - +new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000 + new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getUTCDay() + 1) / 7);
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      const prev = byWeek.get(key) || { count: 0, distance: 0 };
      byWeek.set(key, { count: prev.count + 1, distance: prev.distance + Number(r.total_distance_meters || 0) });
    });
    const lastWeeks = Array.from(byWeek.values()).slice(0, 8);
    const avgWeeklyFrequency = lastWeeks.length ? Number((lastWeeks.reduce((s, v) => s + v.count, 0) / lastWeeks.length).toFixed(2)) : 0;
    const avgWeeklyDistanceKm = lastWeeks.length ? Number(((lastWeeks.reduce((s, v) => s + v.distance, 0) / lastWeeks.length) / 1000).toFixed(1)) : 0;

    // Build AI prompt
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    const haveKey = !!openAIApiKey;

    const context = {
      userId: user.id,
      plan: {
        id: plan.id,
        goal_type: plan.goal_type,
        weeks: plan.weeks,
        start_date: plan.start_date,
        end_date: plan.end_date,
        target_event_date: plan.target_event_date,
      },
      preferences: prefs || null,
      profile: profile || null,
      historySummary: {
        activities_considered: runs.length,
        avg_pace_min_km: avgPace,
        best_pace_min_km: bestPace,
        avg_hr_bpm: avgHr,
        observed_max_hr_bpm: observedMaxHr,
        avg_weekly_frequency: avgWeeklyFrequency,
        avg_weekly_distance_km: avgWeeklyDistanceKm,
      },
      targetPaces: safeTargetPaces,
      safetyLog: {
        total_runs_analyzed: runs.length,
        valid_runs_used: safetyCalibrator.getValidRunData?.() || [],
        safety_calibrator_active: true,
      },
    };

    let aiPlan: any = null;

    if (!haveKey) {
      console.log("⚠️ OPENAI_API_KEY not set. Using enhanced fallback generation.");
      
      // Enhanced fallback with better workout distribution
      const generateEnhancedFallback = () => {
        const workouts: any[] = [];
        const longDay = (prefs?.long_run_weekday ?? 6);
        const days = (prefs?.days_of_week ?? [1, 3, 5, 6]).slice(0, prefs?.days_per_week ?? 4);
        
        for (let w = 1; w <= plan.weeks; w++) {
          // Periodization phases
          const phase = w <= plan.weeks * 0.4 ? 'base' : 
                       w <= plan.weeks * 0.75 ? 'build' : 
                       w <= plan.weeks * 0.9 ? 'peak' : 'taper';
          
          // Is recovery week (every 4th week)
          const isRecoveryWeek = w % 4 === 0;
          const volumeMultiplier = isRecoveryWeek ? 0.7 : 1.0;
          
          days.forEach((dow, i) => {
            let workoutType: string;
            let title: string;
            let description: string;
            let distance_km: number | null = null;
            let duration_min: number | null = null;
            let target_pace: string | null = null;
            let hr_zone: number;
            
            if (dow === longDay) {
              // Long run logic
              workoutType = 'long_run';
              const baseLongDistance = Math.min(10 + w * 0.8, 22);
              distance_km = Math.round(baseLongDistance * volumeMultiplier);
              
              if (phase === 'build' || phase === 'peak') {
                title = `Longão ${distance_km}km com bloco em ritmo de prova`;
                description = `${distance_km}km total. Últimos 6-8km em ritmo de meia maratona (${targetPaces?.pace_half_marathon?.toFixed(2) || '5:30'}/km)`;
                target_pace = safeTargetPaces?.pace_half_marathon?.toFixed(2) || '5:30';
              } else {
                title = `Longão aeróbico ${distance_km}km`;
                description = `Corrida contínua em ritmo confortável, zona 2`;
                target_pace = safeTargetPaces?.pace_easy?.toFixed(2) || '6:00';
              }
              hr_zone = 2;
              
            } else {
              // Other workout types based on position and phase
              const workoutIndex = i % 4;
              
              if (workoutIndex === 0 && phase !== 'base') {
                // Interval workouts (more in build/peak phases)
                workoutType = 'interval';
                hr_zone = 4;
                
                const intervalTypes = [
                  { name: '6x800m', duration: 30, pace: safeTargetPaces?.pace_interval_800m, desc: 'rec 2min entre tiros' },
                  { name: '5x1000m', duration: 35, pace: safeTargetPaces?.pace_interval_1km, desc: 'rec 2min30s entre tiros' },
                  { name: '8x400m', duration: 25, pace: safeTargetPaces?.pace_interval_400m, desc: 'rec 90s entre tiros' },
                  { name: '4x1600m', duration: 40, pace: safeTargetPaces?.pace_interval_1km, desc: 'rec 3min entre tiros' },
                ];
                const interval = intervalTypes[w % intervalTypes.length];
                
                title = interval.name;
                description = `Aquecimento 15min + ${interval.name} em ${interval.pace?.toFixed(2) || '4:30'}/km (${interval.desc}) + desaquecimento 10min`;
                duration_min = interval.duration;
                target_pace = interval.pace?.toFixed(2) || '4:30';
                
              } else if (workoutIndex === 1 && phase !== 'taper') {
                // Tempo runs
                workoutType = 'tempo';
                hr_zone = 3;
                const tempoDistance = Math.min(20 + w * 2, 45);
                duration_min = Math.round(tempoDistance * volumeMultiplier);
                
                title = `Tempo run ${duration_min}min`;
                description = `Aquecimento 15min + ${duration_min}min em ritmo de limiar (${safeTargetPaces?.pace_tempo?.toFixed(2) || '4:50'}/km) + desaquecimento 10min`;
                target_pace = safeTargetPaces?.pace_tempo?.toFixed(2) || '4:50';
                
              } else {
                // Easy/recovery runs
                workoutType = w % 7 === 0 ? 'recovery' : 'easy';
                hr_zone = workoutType === 'recovery' ? 1 : 2;
                distance_km = Math.round((5 + w * 0.5) * volumeMultiplier);
                
                title = workoutType === 'recovery' ? `Recuperativo ${distance_km}km` : `Treino base ${distance_km}km`;
                description = workoutType === 'recovery' ? 'Corrida muito leve, foco na recuperação' : 'Corrida aeróbica confortável';
                target_pace = safeTargetPaces?.pace_easy?.toFixed(2) || '5:45';
              }
            }
            
            workouts.push({
              week: w,
              weekday: Object.keys(dayToIndex).find((k) => dayToIndex[k] === dow) || "saturday",
              type: workoutType,
              title,
              description,
              distance_km,
              duration_min,
              target_hr_zone: hr_zone,
              target_pace_min_per_km: target_pace,
              intensity: hr_zone >= 4 ? "high" : hr_zone === 3 ? "moderate" : "low",
            });
          });
        }
        
        return workouts;
      };
      
      aiPlan = {
        plan_summary: {
          periodization: ["base", "build", "peak", "taper"],
          notes: "Plano gerado automaticamente com foco em meia maratona"
        },
        workouts: generateEnhancedFallback(),
      };
    } else {
      const system = `Você é um treinador de corrida especializado em MEIA MARATONA (21km). Crie um plano científico de ${plan.weeks} semanas com:

DISTRIBUIÇÃO OBRIGATÓRIA POR SEMANA (use essas proporções):
- 60% treinos aeróbicos base (easy/recovery) - ritmo easy/Z1-Z2
- 25% longões progressivos - começando Z2, terminando últimos 30-40min em ritmo de prova
- 10% intervalados variados - 400m, 800m, 1000m, 1600m, 2000m em diferentes paces
- 5% tempo runs - ritmo de limiar/10k por 20-45min

ESPECIFICIDADES PARA 21KM:
- Pelo menos 3 longões de 16-20km com blocos em ritmo de meia maratona
- Intervalos médios (1000-2000m) em ritmo de 10k-meia para especificidade
- Progressões de carga com semanas de descarga a cada 3-4 semanas
- Treinos de brick: longão + tempo final em ritmo de prova

PACES OBRIGATÓRIOS (use os valores SEGUROS calculados em targetPaces):
- Easy: pace_easy (recuperação ativa)
- Tempo: pace_tempo (ritmo de limiar/10k) 
- Intervalos 400m: pace_interval_400m
- Intervalos 800m: pace_interval_800m
- Intervalos 1km+: pace_interval_1km
- Ritmo de prova 21k: pace_half_marathon

PERIODIZAÇÃO INTELIGENTE:
- Base (40%): volume aeróbico, técnica, adaptação
- Build (35%): intensidade específica, longões com blocos
- Peak (15%): picos de carga, simuladores de prova
- Taper (10%): redução volume, manutenção intensidade

Responda APENAS JSON válido com a estrutura exata solicitada.`;

      const userPrompt = {
        context,
        required_output_schema: {
          plan_summary: {
            periodization: ["base", "build", "peak", "taper"],
            notes: "Plano científico para meia maratona com paces personalizados",
          },
          workouts: [
            {
              week: "1..N",
              weekday: "one of sunday,monday,tuesday,wednesday,thursday,friday,saturday",
              type: "easy|long_run|interval|tempo|recovery|race_pace_run",
              title: "string - seja específico (ex: '6x800m em 3:20 + 2min rec')",
              description: "string - detalhe série, pace, recuperação",
              distance_km: "number|null - use para easy e long_run",
              duration_min: "number|null - use para tempo e intervalos",
              target_hr_zone: "1..5|null",
              target_pace_min_per_km: "string - pace específico do targetPaces (ex: '4:15')",
              intensity: "low|moderate|high",
              specific_instructions: "detalhes da série, aquecimento, volta à calma"
            },
          ],
          critical_rules: [
            "🛡️ SEGURANÇA CRÍTICA: Use EXATAMENTE os paces seguros de context.targetPaces",
            "🚨 NUNCA exceda os paces calculados - há vidas em jogo",
            "Easy runs: SEMPRE mais lentos que pace_10k + 30s",
            "Tempo runs: MÁXIMO 45min, pace nunca mais rápido que pace_10k",
            "Long runs: SEMPRE em zona aeróbica (pace_easy ou mais lento)",
            "Intervalos: NUNCA mais rápidos que melhor pace observado",
            "MÍNIMO 8 treinos intervalados variados no plano total",
            "Semanas de descarga: reduzir 30% volume a cada 3-4 semanas",
          ],
        },
      };

      console.log("🤖 Calling OpenAI for plan generation...");
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(userPrompt) },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!openaiRes.ok) {
        const txt = await openaiRes.text();
        console.error("OpenAI error:", txt);
        console.log("⚠️ Falling back to enhanced generator due to OpenAI failure.");
        const generateFallback = () => {
          const workouts: any[] = [];
          const longDay = (prefs?.long_run_weekday ?? 6);
          const days = (prefs?.days_of_week ?? [1, 3, 5, 6]).slice(0, (prefs?.days_per_week ?? 4));
          for (let w = 1; w <= plan.weeks; w++) {
            const phase = w <= plan.weeks * 0.4 ? 'base' : w <= plan.weeks * 0.75 ? 'build' : w <= plan.weeks * 0.9 ? 'peak' : 'taper';
            const isRecoveryWeek = w % 4 === 0;
            const volumeMultiplier = isRecoveryWeek ? 0.7 : 1.0;
            days.forEach((dow, i) => {
              let workoutType: string;
              let title: string;
              let description: string;
              let distance_km: number | null = null;
              let duration_min: number | null = null;
              let target_pace: string | null = null;
              let hr_zone: number;
              if (dow === longDay) {
                workoutType = 'long_run';
                const baseLongDistance = Math.min(10 + w * 0.8, 22);
                distance_km = Math.round(baseLongDistance * volumeMultiplier);
                if (phase === 'build' || phase === 'peak') {
                  title = `Longão ${distance_km}km com bloco em ritmo de prova`;
                  description = `${distance_km}km total. Últimos 6-8km em ritmo de meia maratona (${targetPaces?.pace_half_marathon?.toFixed(2) || '5:30'}/km)`;
                  target_pace = targetPaces?.pace_half_marathon?.toFixed(2) || '5:30';
                } else {
                  title = `Longão aeróbico ${distance_km}km`;
                  description = `Corrida contínua em ritmo confortável, zona 2`;
                  target_pace = targetPaces?.pace_easy?.toFixed(2) || '6:00';
                }
                hr_zone = 2;
              } else {
                const workoutIndex = i % 4;
                if (workoutIndex === 0 && phase !== 'base') {
                  workoutType = 'interval';
                  hr_zone = 4;
                  const intervalTypes = [
                    { name: '6x800m', duration: 30, pace: targetPaces?.pace_interval_800m, desc: 'rec 2min entre tiros' },
                    { name: '5x1000m', duration: 35, pace: targetPaces?.pace_interval_1km, desc: 'rec 2min30s entre tiros' },
                    { name: '8x400m', duration: 25, pace: targetPaces?.pace_interval_400m, desc: 'rec 90s entre tiros' },
                    { name: '4x1600m', duration: 40, pace: targetPaces?.pace_interval_1km, desc: 'rec 3min entre tiros' },
                  ];
                  const interval = intervalTypes[w % intervalTypes.length];
                  title = interval.name;
                  description = `Aquecimento 15min + ${interval.name} em ${interval.pace?.toFixed(2) || '4:30'}/km (${interval.desc}) + desaquecimento 10min`;
                  duration_min = interval.duration;
                  target_pace = interval.pace?.toFixed(2) || '4:30';
                } else if (workoutIndex === 1 && phase !== 'taper') {
                  workoutType = 'tempo';
                  hr_zone = 3;
                  const tempoDistance = Math.min(20 + w * 2, 45);
                  duration_min = Math.round(tempoDistance * volumeMultiplier);
                  title = `Tempo run ${duration_min}min`;
                  description = `Aquecimento 15min + ${duration_min}min em ritmo de limiar (${targetPaces?.pace_tempo?.toFixed(2) || '4:50'}/km) + desaquecimento 10min`;
                  target_pace = targetPaces?.pace_tempo?.toFixed(2) || '4:50';
                } else {
                  workoutType = w % 7 === 0 ? 'recovery' : 'easy';
                  hr_zone = workoutType === 'recovery' ? 1 : 2;
                  distance_km = Math.round((5 + w * 0.5) * volumeMultiplier);
                  title = workoutType === 'recovery' ? `Recuperativo ${distance_km}km` : `Treino base ${distance_km}km`;
                  description = workoutType === 'recovery' ? 'Corrida muito leve, foco na recuperação' : 'Corrida aeróbica confortável';
                  target_pace = targetPaces?.pace_easy?.toFixed(2) || '5:45';
                }
              }
              workouts.push({
                week: w,
                weekday: Object.keys(dayToIndex).find((k) => dayToIndex[k] === dow) || 'saturday',
                type: workoutType,
                title,
                description,
                distance_km,
                duration_min,
                target_hr_zone: hr_zone,
                target_pace_min_per_km: target_pace,
                intensity: hr_zone >= 4 ? 'high' : hr_zone === 3 ? 'moderate' : 'low',
              });
            });
          }
          return workouts;
        };
        aiPlan = {
          plan_summary: { periodization: ['base','build','peak','taper'], notes: 'Plano fallback (OpenAI indisponível)' },
          workouts: generateFallback(),
        };
      }

      } else {
        try {
          const openAIResult = await openaiRes.json();
          if (openAIResult.choices?.[0]?.message?.content) {
            const content = openAIResult.choices[0].message.content;
            const cleaned = String(content).replace(/```json|```/gi, "").trim();
            const match = cleaned.match(/\{[\s\S]*\}/);
            const jsonStr = match ? match[0] : cleaned;
            const rawPlan = JSON.parse(jsonStr);
            
            // SAFETY POST-PROCESSOR - Apply safety clamps to all generated workouts
            console.log("🛡️ Applying safety post-processor to OpenAI plan...");
            const safeWorkouts = rawPlan.workouts?.map((workout: any) => {
              const originalPace = parseFloat(workout.target_pace_min_per_km);
              if (!isNaN(originalPace)) {
                const { pace: safePace, warnings } = safetyCalibrator.applySafetyClamps(
                  workout.type, 
                  originalPace, 
                  workout.duration_min
                );
                
                if (warnings.length > 0) {
                  console.log(`🔧 Workout safety adjustments for ${workout.title}:`, warnings);
                }
                
                return {
                  ...workout,
                  target_pace_min_per_km: safePace.toFixed(2),
                  safety_adjusted: originalPace !== safePace,
                  original_pace: originalPace !== safePace ? originalPace.toFixed(2) : undefined,
                };
              }
              return workout;
            }) || [];
            
            aiPlan = {
              ...rawPlan,
              workouts: safeWorkouts,
              safety_processor_applied: true,
            };
            
            console.log("✅ OpenAI plan parsed and safety-processed successfully");
          } else {
            throw new Error("Invalid OpenAI response structure");
          }
        } catch (parseErr) {
          console.error("JSON parse error:", parseErr);
          console.log("⚠️ Falling back due to JSON parse failure.");
          
          const generateSafeFallback = () => {
            const workouts: any[] = [];
            const longDay = (prefs?.long_run_weekday ?? 6);
            const days = (prefs?.days_of_week ?? [1, 3, 5, 6]).slice(0, (prefs?.days_per_week ?? 4));
            
            for (let w = 1; w <= plan.weeks; w++) {
              const phase = w <= plan.weeks * 0.4 ? 'base' : w <= plan.weeks * 0.75 ? 'build' : w <= plan.weeks * 0.9 ? 'peak' : 'taper';
              const isRecoveryWeek = w % 4 === 0;
              const volumeMultiplier = isRecoveryWeek ? 0.7 : 1.0;
              
              days.forEach((dow, i) => {
                let workoutType: string;
                let title: string;
                let description: string;
                let distance_km: number | null = null;
                let duration_min: number | null = null;
                let target_pace: string | null = null;
                let hr_zone: number;
                
                if (dow === longDay) {
                  workoutType = 'long_run';
                  const baseLongDistance = Math.min(10 + w * 0.8, 22);
                  distance_km = Math.round(baseLongDistance * volumeMultiplier);
                  if (phase === 'build' || phase === 'peak') {
                    title = `Longão ${distance_km}km com bloco em ritmo de prova`;
                    description = `${distance_km}km total. Últimos 6-8km em ritmo de meia maratona (${safeTargetPaces?.pace_half_marathon?.toFixed(2) || '5:30'}/km)`;
                    target_pace = safeTargetPaces?.pace_half_marathon?.toFixed(2) || '5:30';
                  } else {
                    title = `Longão aeróbico ${distance_km}km`;
                    description = `Corrida contínua em ritmo confortável, zona 2`;
                    target_pace = safeTargetPaces?.pace_easy?.toFixed(2) || '6:00';
                  }
                  hr_zone = 2;
                } else {
                  const workoutIndex = i % 4;
                  if (workoutIndex === 0 && phase !== 'base') {
                    workoutType = 'interval';
                    hr_zone = 4;
                    const intervalTypes = [
                      { name: '6x800m', duration: 30, pace: safeTargetPaces?.pace_interval_800m, desc: 'rec 2min entre tiros' },
                      { name: '5x1000m', duration: 35, pace: safeTargetPaces?.pace_interval_1km, desc: 'rec 2min30s entre tiros' },
                      { name: '8x400m', duration: 25, pace: safeTargetPaces?.pace_interval_400m, desc: 'rec 90s entre tiros' },
                      { name: '4x1600m', duration: 40, pace: safeTargetPaces?.pace_interval_1km, desc: 'rec 3min entre tiros' },
                    ];
                    const interval = intervalTypes[w % intervalTypes.length];
                    title = interval.name;
                    description = `Aquecimento 15min + ${interval.name} em ${interval.pace?.toFixed(2) || '4:30'}/km (${interval.desc}) + desaquecimento 10min`;
                    duration_min = interval.duration;
                    target_pace = interval.pace?.toFixed(2) || '4:30';
                  } else if (workoutIndex === 1 && phase !== 'taper') {
                    workoutType = 'tempo';
                    hr_zone = 3;
                    const tempoDistance = Math.min(20 + w * 2, 30); // Reduced max to 30min for safety
                    duration_min = Math.round(tempoDistance * volumeMultiplier);
                    title = `Tempo run ${duration_min}min`;
                    description = `Aquecimento 15min + ${duration_min}min em ritmo de limiar (${safeTargetPaces?.pace_tempo?.toFixed(2) || '4:50'}/km) + desaquecimento 10min`;
                    target_pace = safeTargetPaces?.pace_tempo?.toFixed(2) || '4:50';
                  } else {
                    workoutType = w % 7 === 0 ? 'recovery' : 'easy';
                    hr_zone = workoutType === 'recovery' ? 1 : 2;
                    distance_km = Math.round((5 + w * 0.5) * volumeMultiplier);
                    title = workoutType === 'recovery' ? `Recuperativo ${distance_km}km` : `Treino base ${distance_km}km`;
                    description = workoutType === 'recovery' ? 'Corrida muito leve, foco na recuperação' : 'Corrida aeróbica confortável';
                    target_pace = safeTargetPaces?.pace_easy?.toFixed(2) || '5:45';
                  }
                }
                
                workouts.push({
                  week: w,
                  weekday: Object.keys(dayToIndex).find((k) => dayToIndex[k] === dow) || 'saturday',
                  type: workoutType,
                  title,
                  description,
                  distance_km,
                  duration_min,
                  target_hr_zone: hr_zone,
                  target_pace_min_per_km: target_pace,
                  intensity: hr_zone >= 4 ? 'high' : hr_zone === 3 ? 'moderate' : 'low',
                  safety_fallback: true,
                });
              });
            }
            return workouts;
          };
          
          aiPlan = {
            plan_summary: { periodization: ['base','build','peak','taper'], notes: '🛡️ Plano SEGURO gerado com fallback' },
            workouts: generateSafeFallback(),
          };
        }
      }
    }

    // FINAL SAFETY CHECK before database insertion
    console.log("🛡️ Performing final safety validation before database insertion...");
    const finalSafeWorkouts = (aiPlan.workouts || []).map((w: any) => {
      const pace = parseFloat(w.target_pace_min_per_km);
      if (!isNaN(pace)) {
        const { pace: finalSafePace, warnings } = safetyCalibrator.applySafetyClamps(
          w.type, 
          pace, 
          w.duration_min
        );
        
        if (warnings.length > 0) {
          console.log(`🚨 FINAL SAFETY CHECK - ${w.title}:`, warnings);
        }
        
        return {
          ...w,
          target_pace_min_per_km: finalSafePace.toFixed(2),
          final_safety_check: true,
        };
      }
      return w;
    });
    
    // Map to database format and insert
    const startDate = new Date(plan.start_date);
    const workouts = finalSafeWorkouts.filter((w: any) => w.type !== "rest");

    const rows = workouts.map((w: any) => {
      const weekdayIdx = dayToIndex[(w.weekday || "").toLowerCase()] ?? 6; // default Saturday
      const date = getDateForWeekday(startDate, Number(w.week) || 1, weekdayIdx);
      const distance_meters = typeof w.distance_km === "number" ? Math.round(w.distance_km * 1000) : null;
      const duration_minutes = typeof w.duration_min === "number" ? w.duration_min : null;
      
      // Parse target pace from string format (e.g., "4:30" -> 4.5)
      let target_pace_min_km: number | null = null;
      if (w.target_pace_min_per_km) {
        const paceStr = String(w.target_pace_min_per_km);
        const paceMatch = paceStr.match(/(\d+):(\d+)/);
        if (paceMatch) {
          const minutes = parseInt(paceMatch[1]);
          const seconds = parseInt(paceMatch[2]);
          target_pace_min_km = minutes + seconds / 60;
        } else {
          // Try parsing as decimal
          const paceNum = parseFloat(paceStr);
          if (!isNaN(paceNum)) target_pace_min_km = paceNum;
        }
      }

      return {
        user_id: user.id,
        plan_id: plan.id,
        workout_date: formatDate(date),
        title: String(w.title || `${w.type} run`).slice(0, 120),
        description: w.description || null,
        workout_type: w.type || null,
        target_pace_min_km,
        target_hr_zone: w.target_hr_zone ? String(w.target_hr_zone) : null,
        distance_meters,
        duration_minutes,
        status: "planned",
        completed_activity_source: null,
        completed_activity_id: null,
      } as const;
    });

    // Clean previous generated workouts for this plan (idempotency)
    await supabase.from("training_plan_workouts").delete().eq("plan_id", plan.id);

    // Insert in chunks to avoid payload limits
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error: insErr } = await supabase.from("training_plan_workouts").insert(chunk);
      if (insErr) {
        console.error("Insert workouts error:", insErr);
        throw new Error("Failed to save workouts");
      }
    }

    // Update plan status
    const { error: updErr } = await supabase
      .from("training_plans")
      .update({ status: "active", generated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (updErr) console.warn("Failed to update plan status", updErr);

    return new Response(
      JSON.stringify({
        ok: true,
        plan_id: plan.id,
        workouts_created: rows.length,
        summary: aiPlan?.plan_summary || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("❌ generate-training-plan error:", err?.message || err);
    return new Response(JSON.stringify({ ok: false, error: err?.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
