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
      runs: any[];
      profile: any;
      constructor(runs: any[], profile: any) {
        this.runs = runs;
        this.profile = profile;
      }

      public getValidRunData() {
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return (this.runs || []).filter((r: any) => {
          const pace = Number(r.pace_min_per_km);
          const dist = Number(r.total_distance_meters || 0) / 1000;
          const dur = Number(r.total_time_minutes || 0);
          const date = new Date(r.activity_date);
          return (
            Number.isFinite(pace) && Number.isFinite(dist) && Number.isFinite(dur) &&
            pace > 3 && pace < 12 &&
            dist >= 2 &&
            dur >= 10 &&
            date >= cutoffDate
          );
        });
      }

      private calculateBaselines() {
        const valid = this.getValidRunData();
        if (!valid.length) return this.getDefaults();

        const paces = valid.map((r: any) => Number(r.pace_min_per_km)).sort((a: number, b: number) => a - b);
        const best = paces[0];                                   // Melhor pace observado
        const median = paces[Math.floor(paces.length / 2)];      // Mediana
        const p75 = paces[Math.floor(paces.length * 0.75)];      // Percentil 75 (mais lento)

        // ---- Previsão de provas (usando BEST) ----
        const base5kMin = best * 5;
        const riegel = (t1: number, d1: number, d2: number) => t1 * Math.pow(d2 / d1, 1.06);

        const pace_10k = riegel(base5kMin, 5, 10) / 10;
        const pace_half_val = riegel(base5kMin, 5, 21.097) / 21.097;
        const pace_marathon = riegel(base5kMin, 5, 42.195) / 42.195;

        return {
          // Estatísticas de referência
          pace_best: best,
          pace_median: median,
          pace_p75: p75,

          // Previsão de provas
          pace_5k: best,
          pace_10k,
          pace_half: pace_half_val,
          pace_marathon,

          // Zonas de treino (usando median + p75 para segurança)
          pace_easy: Math.max(median + 1.0, p75),
          pace_long: Math.max(median + 0.7, p75),
          pace_tempo: best + 0.35,             // ~20-30s mais lento que best
          pace_interval_400m: best - 0.15,     // ~10s mais rápido que best
          pace_interval_800m: best,
          pace_interval_1km: best + 0.10,

          // Alias de compatibilidade
          pace_half_marathon: pace_half_val,
        };
      }

      private getDefaults() {
        const age = this.profile?.birth_date
          ? Math.floor((Date.now() - new Date(this.profile.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
          : 35;
        const base = age < 25 ? 5.5 : age < 35 ? 6.0 : age < 45 ? 6.5 : 7.0;
        return {
          pace_best: base,
          pace_median: base,
          pace_p75: base + 0.5,
          pace_5k: base,
          pace_10k: base * 1.08,
          pace_half: base * 1.15,
          pace_marathon: base * 1.25,
          pace_easy: base + 1.0,
          pace_long: base + 0.7,
          pace_tempo: base * 0.95,
          pace_interval_400m: base * 0.9,
          pace_interval_800m: base * 0.95,
          pace_interval_1km: base,
          pace_half_marathon: base * 1.15,
        };
      }

      public applySafetyClamps(type: string, pace: number, duration?: number): { pace: number; warnings: string[] } {
        const b = this.calculateBaselines();
        let safe = pace;
        const warnings: string[] = [];

        switch ((type || '').toLowerCase()) {
          case "easy":
          case "recovery":
            if (safe < b.pace_10k + 0.5) {
              safe = b.pace_10k + 0.5;
              warnings.push("Easy ajustado para manter Z2.");
            }
            break;
          case "long_run":
            if (safe < b.pace_10k + 0.4) {
              safe = b.pace_10k + 0.4;
              warnings.push("Long run ajustado para manter aeróbico.");
            }
            break;
          case "tempo":
            if (safe < b.pace_10k) {
              safe = b.pace_10k;
              warnings.push("Tempo não pode ser mais rápido que 10k.");
            }
            if (duration && duration > 45) {
              warnings.push("Tempo >45min não recomendado.");
            }
            break;
          case "interval":
            if (safe < b.pace_best) {
              safe = b.pace_best;
              warnings.push("Intervalo não pode ser mais rápido que melhor pace observado.");
            }
            break;
        }

        return { pace: safe, warnings };
      }

      public getSafeTargetPaces() {
        return this.calculateBaselines();
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
let usedFallback = false;
let fallbackReason: string | null = null;

    if (!haveKey) {
      console.log("⚠️ OPENAI_API_KEY not set. Using enhanced fallback generation.");
      usedFallback = true;
      fallbackReason = "no_openai_key";
      
      // Enhanced fallback with better workout distribution
      const generateEnhancedFallback = () => {
        const workouts: any[] = [];
        const longDay = (prefs?.long_run_weekday ?? 6);
        const days = (prefs?.days_of_week ?? [1, 3, 5, 6]).slice(0, prefs?.days_per_week ?? 4);
        const targetPaces = safeTargetPaces;
        
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
          model: "gpt-5-mini-2025-08-07",
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(userPrompt) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "training_plan",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  plan_summary: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      periodization: { type: "array", items: { type: "string" } },
                      notes: { type: "string" }
                    },
                    required: ["periodization", "notes"]
                  },
                  workouts: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        week: { type: "integer" },
                        weekday: { type: "string" },
                        type: { type: "string" },
                        title: { type: "string" },
                        description: { type: ["string","null"] },
                        distance_km: { type: ["number","null"] },
                        duration_min: { type: ["number","null"] },
                        target_hr_zone: { type: ["integer","null"] },
                        target_pace_min_per_km: { type: ["string","null"] },
                        intensity: { type: ["string","null"] },
                        specific_instructions: { type: ["string","null"] }
                      },
                      required: ["week","weekday","type","title"]
                    }
                  }
                },
                required: ["workouts"]
              }
            }
          },
          max_completion_tokens: 4000,
        }),
      });

      if (!openaiRes.ok) {
        const txt = await openaiRes.text();
        console.error("OpenAI error:", txt);
        console.log("⚠️ Falling back to enhanced generator due to OpenAI failure.");
        usedFallback = true;
        fallbackReason = "openai_http_error";
        const generateFallback = () => {
          const workouts: any[] = [];
          const longDay = (prefs?.long_run_weekday ?? 6);
          const days = (prefs?.days_of_week ?? [1, 3, 5, 6]).slice(0, (prefs?.days_per_week ?? 4));
          const targetPaces = safeTargetPaces;
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
                  const tempoDistance = Math.min(20 + w * 2, 45);
                  duration_min = Math.round(tempoDistance * volumeMultiplier);
                  title = `Tempo run ${duration_min}min`;
                  description = `Aquecimento 15min + ${duration_min}min em ritmo de limiar (${targetPaces?.pace_tempo?.toFixed(2) || '4:50'}/km) + desaquecimento 10min`;
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

       else {
        try {
          const openAIResult = await openaiRes.json();
          const choice = openAIResult?.choices?.[0];
          let rawPlan: any | null = null;

          // Prefer parsed object when using response_format=json_schema
          const maybeParsed = choice?.message && (choice.message as any).parsed;
          if (maybeParsed && typeof maybeParsed === "object") {
            rawPlan = maybeParsed;
          } else {
            // Fallback to parsing message.content
            const maybeContent: any = choice?.message?.content;
            const contentStr =
              typeof maybeContent === "string"
                ? maybeContent
                : (Array.isArray(maybeContent) && typeof maybeContent[0]?.text === "string")
                ? maybeContent[0].text
                : "";

            if (!contentStr) {
              throw new Error("Invalid OpenAI response: no content or parsed");
            }

            // Helpers to robustly extract and sanitize JSON from LLM output
            const stripFences = (s: string) => s.replace(/```json|```/gi, "").trim();
            const extractJsonBlock = (s: string) => {
              const m = s.match(/\{[\s\S]*\}/);
              return m ? m[0] : s;
            };
            const sanitizeJson = (s: string) =>
              s
                .replace(/(^|\s)\/\/.*$/gm, "")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/\r\n/g, "\n")
                .replace(/,(\s*[}\]])/g, "$1");

            const cleaned = stripFences(String(contentStr));
            const jsonCandidate = extractJsonBlock(cleaned);
            try {
              rawPlan = JSON.parse(jsonCandidate);
            } catch (e1) {
              try {
                rawPlan = JSON.parse(sanitizeJson(jsonCandidate));
              } catch (e2) {
                console.error("❌ OpenAI plan JSON parse failed twice. First:", (e1 as any)?.message, "Second:", (e2 as any)?.message);
                throw e2;
              }
            }
          }

          // Validate plan structure before post-processing
          if (!rawPlan || !Array.isArray(rawPlan.workouts)) {
            throw new Error("Invalid plan schema from OpenAI");
          }

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
        } catch (parseErr) {
          console.error("JSON parse error:", parseErr);
          console.log("⚠️ Falling back due to JSON parse failure.");
          usedFallback = true;
          fallbackReason = "json_parse_error";
          
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
        used_fallback: usedFallback,
        fallback_reason: fallbackReason,
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
