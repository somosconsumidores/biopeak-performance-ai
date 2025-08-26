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

    // Aggregate basics
    const runs = (activities || []).filter((a) => (a.activity_type || "").toLowerCase().includes("run"));
    const paces = runs.map((r: any) => Number(r.pace_min_per_km)).filter((v) => Number.isFinite(v) && v > 0);
    const bestPace = paces.length ? Math.min(...paces) : null;
    const avgPace = paces.length ? paces.reduce((s, v) => s + v, 0) / paces.length : null;
    const avgHrVals = runs.map((r: any) => Number(r.average_heart_rate)).filter((v) => Number.isFinite(v) && v > 0);
    const avgHr = avgHrVals.length ? Math.round(avgHrVals.reduce((s, v) => s + v, 0) / avgHrVals.length) : null;
    const maxHrVals = runs.map((r: any) => Number(r.max_heart_rate)).filter((v) => Number.isFinite(v) && v > 0);
    const observedMaxHr = maxHrVals.length ? Math.max(...maxHrVals) : null;

    // Calculate target paces based on best performance (Riegel formula)
    const calculateTargetPaces = (bestPaceMinKm: number) => {
      // Base time for best pace distance (assuming 5k for best pace)
      const base5kTimeMin = bestPaceMinKm * 5;
      
      // Calculate target paces using Riegel formula: T2 = T1 * (D2/D1)^1.06
      const riegel = (baseTimeMin: number, baseDistKm: number, targetDistKm: number) => {
        return baseTimeMin * Math.pow(targetDistKm / baseDistKm, 1.06);
      };

      return {
        pace_1500m: bestPaceMinKm * 0.95, // ~5% faster than 5k pace
        pace_5k: bestPaceMinKm,
        pace_10k: riegel(base5kTimeMin, 5, 10) / 10,
        pace_half_marathon: riegel(base5kTimeMin, 5, 21.0975) / 21.0975,
        pace_marathon: riegel(base5kTimeMin, 5, 42.195) / 42.195,
        // Training paces
        pace_easy: bestPaceMinKm * 1.15, // 15% slower than 5k
        pace_tempo: riegel(base5kTimeMin, 5, 10) / 10, // ~10k pace
        pace_threshold: bestPaceMinKm * 1.05, // Between 5k and 10k pace
        pace_interval_400m: bestPaceMinKm * 0.90, // ~10% faster than 5k
        pace_interval_800m: bestPaceMinKm * 0.95, // ~5% faster than 5k
        pace_interval_1km: bestPaceMinKm, // ~5k pace
        pace_interval_1mile: bestPaceMinKm * 1.02, // slightly slower than 5k
      };
    };

    const targetPaces = bestPace ? calculateTargetPaces(bestPace) : null;

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
      targetPaces: targetPaces,
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
                target_pace = targetPaces?.pace_half_marathon?.toFixed(2) || '5:30';
              } else {
                title = `Longão aeróbico ${distance_km}km`;
                description = `Corrida contínua em ritmo confortável, zona 2`;
                target_pace = targetPaces?.pace_easy?.toFixed(2) || '6:00';
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
                // Tempo runs
                workoutType = 'tempo';
                hr_zone = 3;
                const tempoDistance = Math.min(20 + w * 2, 45);
                duration_min = Math.round(tempoDistance * volumeMultiplier);
                
                title = `Tempo run ${duration_min}min`;
                description = `Aquecimento 15min + ${duration_min}min em ritmo de limiar (${targetPaces?.pace_tempo?.toFixed(2) || '4:50'}/km) + desaquecimento 10min`;
                target_pace = targetPaces?.pace_tempo?.toFixed(2) || '4:50';
                
              } else {
                // Easy/recovery runs
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

PACES OBRIGATÓRIOS (use os valores calculados em targetPaces):
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
            "OBRIGATÓRIO: Use EXATAMENTE os paces de context.targetPaces",
            "MÍNIMO 8 treinos intervalados variados no plano total",
            "Longões SEMPRE com progressão ou blocos em ritmo específico",
            "Semanas de descarga: reduzir 30% volume a cada 3-4 semanas",
            "Últimas 3 semanas: 1 simulador de prova (15-18km com bloco final)",
            "Variar intervalos: 400m, 800m, 1000m, 1600m, 2000m",
            "Tempo runs: 20-45min em pace_tempo progressivamente"
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

      const openaiJson = await openaiRes.json();
      const content = openaiJson.choices?.[0]?.message?.content || "";
      const cleaned = String(content).replace(/```json|```/gi, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : cleaned;
      try {
        aiPlan = JSON.parse(jsonStr);
        console.log("✅ AI plan parsed");
      } catch (e) {
        console.error("JSON parse error", e);
        console.log("⚠️ Falling back to enhanced generator due to invalid JSON.");
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
          plan_summary: { periodization: ['base','build','peak','taper'], notes: 'Plano fallback (JSON inválido da OpenAI)' },
          workouts: generateFallback(),
        };
      }
    }

    // Map AI workouts to DB rows
    const startDate = new Date(plan.start_date);
    const workouts = (aiPlan?.workouts || []).filter((w: any) => w.type !== "rest");

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
