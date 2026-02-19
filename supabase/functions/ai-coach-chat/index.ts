import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const MAX_ITERATIONS = 10;
const TIMEOUT_MS = 25000;

async function checkRateLimit(userId: string, sb: any) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await sb
    .from('ai_coach_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', fiveMinAgo);
  
  if (count && count >= 20) {
    throw new Error('RATE_LIMIT');
  }
}

const coachTools = [
  { type: "function", function: { name: "get_last_activity", description: "Busca última atividade com pace, FC, distância", parameters: { type: "object", properties: { activity_type: { type: "string", description: "RUNNING, CYCLING, etc" } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_activity_by_date", description: "Atividade em data específica", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"], additionalProperties: false } } },
  { type: "function", function: { name: "get_training_plan", description: "Retorna TODOS os planos ativos do atleta (corrida, ciclismo, natação, força) e próximos treinos de cada", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_sleep_data", description: "Dados de sono", parameters: { type: "object", properties: { days: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_fitness_scores", description: "CTL, ATL, TSB", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_athlete_metrics", description: "Busca métricas fisiológicas: VO2max (dados Garmin), paces de referência (5K, 10K), FC máxima, zonas de treino. USE SEMPRE para: perguntas sobre VO2max, capacidade aeróbica, zonas de frequência cardíaca, ou antes de criar treinos científicos.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "reschedule_workout", description: "Move treino para outra data", parameters: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" }, strategy: { type: "string", enum: ["swap", "replace", "push"] } }, required: ["from_date", "to_date"], additionalProperties: false } } },
  { type: "function", function: { name: "create_scientific_workout", description: "Cria treino científico com paces e estrutura detalhada baseado nas métricas do atleta. IMPORTANTE: sempre passe duration_minutes quando o atleta especificar duração desejada.", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, workout_category: { type: "string", enum: ["vo2max", "threshold", "tempo", "long_run", "recovery", "speed", "fartlek", "progressive"], description: "Tipo de treino" }, duration_minutes: { type: "number", description: "Duração desejada em minutos (ex: 20, 30, 45). Quando o atleta pede um tempo específico, passe aqui." }, athlete_metrics: { type: "object", description: "Métricas do atleta obtidas via get_athlete_metrics" } }, required: ["date", "workout_category"], additionalProperties: false } } },
  { type: "function", function: { name: "mark_workout_complete", description: "Marca treino concluído", parameters: { type: "object", properties: { workout_date: { type: "string" } }, required: ["workout_date"], additionalProperties: false } } },
  { type: "function", function: { name: "cancel_training_plan", description: "Cancela plano de treino do usuário. Use quando atleta pedir para encerrar, pausar ou cancelar um plano.", parameters: { type: "object", properties: { sport_type: { type: "string", enum: ["running", "cycling", "swimming", "strength"], description: "Tipo do plano: running (corrida), cycling (ciclismo), swimming (natação), strength (força/musculação)" }, reason: { type: "string", description: "Motivo do cancelamento para registro" } }, required: ["sport_type"], additionalProperties: false } } },
  { type: "function", function: { name: "get_monthly_summary", description: "Resumo AGREGADO de performance de um mês inteiro. USE SEMPRE que o usuário perguntar sobre performance mensal, 'como foi meu mês', 'janeiro', 'fevereiro', 'meu histórico', evolução mensal, etc. NUNCA use get_activity_by_date para análise mensal — use esta tool.", parameters: { type: "object", properties: { year: { type: "number", description: "Ano (ex: 2026)" }, month: { type: "number", description: "Mês (1-12)" } }, required: ["year", "month"], additionalProperties: false } } }
];

async function executeTool(name: string, args: any, sb: any, uid: string) {
  if (name === "get_last_activity") {
    let q = sb.from('all_activities').select('*').eq('user_id', uid);
    if (args.activity_type) q = q.eq('activity_type', args.activity_type);
    const { data } = await q.order('activity_date', { ascending: false }).limit(1).maybeSingle();
    if (!data) return { found: false, message: 'Nenhuma atividade' };
    return { found: true, date: data.activity_date, type: data.activity_type, distance_km: data.total_distance_meters ? (data.total_distance_meters/1000).toFixed(2) : null, duration_min: data.total_time_minutes ? Math.round(data.total_time_minutes) : null, pace: data.pace_min_per_km ? Number(data.pace_min_per_km).toFixed(2) : null, hr_avg: data.average_heart_rate, hr_max: data.max_heart_rate };
  }
  if (name === "get_activity_by_date") {
    const { data } = await sb.from('all_activities').select('*').eq('user_id', uid).eq('activity_date', args.date);
    if (!data?.length) return { found: false, date: args.date };
    return { found: true, activities: data.map((a: any) => ({ type: a.activity_type, distance_km: a.total_distance_meters?(a.total_distance_meters/1000).toFixed(2):null, pace: a.pace_min_per_km?Number(a.pace_min_per_km).toFixed(2):null, hr_avg: a.average_heart_rate })) };
  }
  if (name === "get_training_plan") {
    // Buscar TODOS os planos ativos (multi-esporte)
    const { data: plans } = await sb.from('training_plans').select('*').eq('user_id', uid).eq('status', 'active');
    if (!plans?.length) return { found: false, message: 'Nenhum plano ativo' };
    
    const result = [];
    const today = new Date().toISOString().split('T')[0];
    
    for (const plan of plans) {
      const { data: workouts } = await sb.from('training_plan_workouts').select('id, workout_date, title, workout_type, status').eq('plan_id', plan.id).gte('workout_date', today).eq('status', 'planned').order('workout_date').limit(5);
      result.push({
        id: plan.id,
        name: plan.plan_name || plan.goal_type,
        sport: plan.sport_type,
        goal: plan.goal_type,
        start_date: plan.start_date,
        end_date: plan.end_date,
        upcoming_workouts: workouts?.map((w: any) => ({ date: w.workout_date, title: w.title, type: w.workout_type })) || []
      });
    }
    return { found: true, plans: result, total_active: result.length };
  }
  if (name === "get_sleep_data") {
    const days = args.days || 7;
    const d = new Date(); d.setDate(d.getDate() - days);
    const { data } = await sb.from('garmin_sleep_summaries').select('calendar_date, sleep_score, sleep_time_in_seconds').eq('user_id', uid).gte('calendar_date', d.toISOString().split('T')[0]).order('calendar_date', { ascending: false });
    if (!data?.length) return { found: false };
    const avg = data.reduce((s: number, r: any) => s + (r.sleep_score || 0), 0) / data.length;
    return { found: true, avg_score: Math.round(avg), nights: data.slice(0, 5).map((s: any) => ({ date: s.calendar_date, score: s.sleep_score })) };
  }
  if (name === "get_fitness_scores") {
    const { data } = await sb.from('fitness_scores_daily').select('calendar_date, ctl_42day, atl_7day').eq('user_id', uid).order('calendar_date', { ascending: false }).limit(1).maybeSingle();
    if (!data) return { found: false, reason: "Nenhum dado de carga encontrado" };
    let ctl = data.ctl_42day;
    let atl = data.atl_7day;
    // Normalizar escala: banco armazena valores ~10x maiores
    if (ctl > 200) ctl = ctl / 10;
    if (atl > 200) atl = atl / 10;
    // Sanity check pos-normalizacao
    if (!ctl || !atl || ctl > 200 || atl > 200 || ctl < 0 || atl < 0) {
      return {
        found: false,
        reason: `Valores de CTL/ATL fora do intervalo esperado mesmo apos normalizacao. Dado indisponivel.`
      };
    }
    const tsb = ctl - atl;
    return {
      found: true,
      ctl: ctl.toFixed(1),
      atl: atl.toFixed(1),
      tsb: tsb.toFixed(1),
      date: data.calendar_date,
      status: tsb > 25  ? 'Muito fresco — volume baixo recente'
            : tsb > 5   ? 'Fresco — pronto para treino intenso'
            : tsb > -5  ? 'Balanceado'
            : tsb > -25 ? 'Sob carga — monitore recuperacao'
            :             'Fadiga acumulada — priorize descanso'
    };
  }
  
  // NEW: Get athlete metrics for scientific workout generation
  if (name === "get_athlete_metrics") {
    // Get Garmin tokens for garmin_user_id
    const { data: tokens } = await sb.from('garmin_tokens').select('garmin_user_id').eq('user_id', uid).eq('is_active', true).limit(1);
    const garminUserId = tokens?.[0]?.garmin_user_id;
    
    // Get VO2max from Garmin with date
    let vo2max = null;
    let vo2maxDate = null;
    let vo2maxSource: string | null = null;
    
    if (garminUserId) {
      const { data: vo2Data } = await sb.from('garmin_vo2max').select('vo2_max_running, vo2_max_cycling, calendar_date').eq('garmin_user_id', garminUserId).order('calendar_date', { ascending: false }).limit(1).maybeSingle();
      vo2max = vo2Data?.vo2_max_running || vo2Data?.vo2_max_cycling || null;
      vo2maxDate = vo2Data?.calendar_date || null;
      if (vo2max) vo2maxSource = 'Garmin';
    }
    
    // Fallback: Get VO2max from Daniels formula if Garmin is null
    if (!vo2max) {
      const { data: danielsData } = await sb
        .from('v_all_activities_with_vo2_daniels')
        .select('vo2_max_daniels, activity_date')
        .eq('user_id', uid)
        .not('vo2_max_daniels', 'is', null)
        .order('activity_date', { ascending: false })
        .limit(10);
      
      if (danielsData?.length) {
        // Use the maximum VO2max from recent activities (best effort)
        const maxDaniels = Math.max(...danielsData.map((d: any) => d.vo2_max_daniels));
        vo2max = Math.round(maxDaniels * 10) / 10;
        vo2maxDate = danielsData[0]?.activity_date || null;
        vo2maxSource = 'Calculado (Daniels)';
      }
    }
    
    // Get best paces from activities (last 90 days)
    const d90 = new Date(); d90.setDate(d90.getDate() - 90);
    const { data: runs } = await sb.from('all_activities').select('total_distance_meters, pace_min_per_km, average_heart_rate, max_heart_rate').eq('user_id', uid).eq('activity_type', 'RUNNING').gte('activity_date', d90.toISOString().split('T')[0]).order('pace_min_per_km', { ascending: true });
    
    // Find best pace for different distances
    let best5k = null, best10k = null, hrMax = null;
    if (runs?.length) {
      for (const r of runs) {
        if (r.max_heart_rate && (!hrMax || r.max_heart_rate > hrMax)) hrMax = r.max_heart_rate;
        const dist = r.total_distance_meters || 0;
        if (dist >= 4500 && dist <= 6000 && r.pace_min_per_km && (!best5k || r.pace_min_per_km < best5k)) best5k = r.pace_min_per_km;
        if (dist >= 9000 && dist <= 12000 && r.pace_min_per_km && (!best10k || r.pace_min_per_km < best10k)) best10k = r.pace_min_per_km;
      }
    }
    
    // Calculate zones based on HR max (default 185 if not found)
    const fcMax = hrMax || 185;
    const zones = {
      z1: { min: Math.round(fcMax * 0.50), max: Math.round(fcMax * 0.60) },
      z2: { min: Math.round(fcMax * 0.60), max: Math.round(fcMax * 0.70) },
      z3: { min: Math.round(fcMax * 0.70), max: Math.round(fcMax * 0.80) },
      z4: { min: Math.round(fcMax * 0.80), max: Math.round(fcMax * 0.90) },
      z5: { min: Math.round(fcMax * 0.90), max: fcMax }
    };
    
    // Calculate training paces based on best 5k or estimate from VO2max
    const referencePace = best5k || (vo2max ? 29.5 - (vo2max * 0.5) : 5.5); // Daniels approximation
    const paces = {
      easy: (referencePace * 1.35).toFixed(2),       // Z2: ~35% slower
      tempo: (referencePace * 1.08).toFixed(2),      // Z4: ~8% slower  
      threshold: (referencePace * 1.03).toFixed(2),  // Z4: ~3% slower
      interval: (referencePace * 0.95).toFixed(2),   // Z5: ~5% faster
      repetition: (referencePace * 0.88).toFixed(2)  // Speed: ~12% faster
    };
    
    return { 
      found: true, 
      vo2max,
      vo2max_date: vo2maxDate,
      vo2max_source: vo2maxSource,
      hr_max: fcMax,
      zones,
      best_paces: { pace_5k: best5k?.toFixed(2) || null, pace_10k: best10k?.toFixed(2) || null },
      training_paces: paces,
      reference_pace_source: best5k ? '5K real' : vo2max ? 'VO2max estimado' : 'padrão'
    };
  }
  
  if (name === "reschedule_workout") {
    const { data: plan } = await sb.from('training_plans').select('id').eq('user_id', uid).eq('status', 'active').maybeSingle();
    if (!plan) return { success: false, error: 'Sem plano ativo' };
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/coach-reschedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-coach-key': Deno.env.get('COACH_EDGE_KEY') || '' },
      body: JSON.stringify({ user_id: uid, plan_id: plan.id, from_date: args.from_date, to_date: args.to_date, strategy: args.strategy || 'replace' })
    });
    const r = await res.json();
    return res.ok ? { success: true, message: r.message } : { success: false, error: r.error || r.message };
  }
  
  // NEW: Create scientific workout with calculated paces (with ad-hoc plan fallback)
  if (name === "create_scientific_workout") {
    // Priority 1: Find active "real" plan (not ad-hoc)
    let { data: plan } = await sb.from('training_plans')
      .select('id')
      .eq('user_id', uid)
      .eq('status', 'active')
      .neq('goal_type', 'fitness') // Exclude ad-hoc plans
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Priority 2: Find existing ad-hoc plan
    if (!plan) {
      const { data: adhocPlan } = await sb.from('training_plans')
        .select('id')
        .eq('user_id', uid)
        .eq('status', 'active')
        .eq('goal_type', 'fitness')
        .eq('plan_name', 'Treinos Avulsos')
        .maybeSingle();
      
      plan = adhocPlan;
    }
    
    // Priority 3: Create new ad-hoc plan
    if (!plan) {
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90); // 90 days validity
      
      const { data: newPlan, error: createError } = await sb
        .from('training_plans')
        .insert({
          user_id: uid,
          plan_name: 'Treinos Avulsos',
          goal_type: 'fitness',
          sport_type: 'running',
          start_date: today,
          end_date: endDate.toISOString().split('T')[0],
          weeks: 12,
          status: 'active'
        })
        .select('id')
        .single();
        
      if (createError) {
        console.error('[create_scientific_workout] Failed to create ad-hoc plan:', createError);
        return { success: false, error: 'Falha ao criar plano para treino avulso' };
      }
      
      console.log('[create_scientific_workout] Created ad-hoc plan:', newPlan.id);
      plan = newPlan;
    }
    
    const metrics = args.athlete_metrics || {};
    const defaultPaces = { easy: '6:30', tempo: '5:15', threshold: '5:00', interval: '4:40', repetition: '4:20' };
    const paces = { ...defaultPaces, ...(metrics.training_paces || {}) };
    
    const defaultZones = { z1: {min:93,max:111}, z2: {min:111,max:130}, z3: {min:130,max:148}, z4: {min:148,max:167}, z5: {min:167,max:185} };
    const rawZones = metrics.zones || {};
    const zones = {
      z1: { ...defaultZones.z1, ...(rawZones.z1 || {}) },
      z2: { ...defaultZones.z2, ...(rawZones.z2 || {}) },
      z3: { ...defaultZones.z3, ...(rawZones.z3 || {}) },
      z4: { ...defaultZones.z4, ...(rawZones.z4 || {}) },
      z5: { ...defaultZones.z5, ...(rawZones.z5 || {}) },
    };
    const hrMax = metrics.hr_max || 185;
    
    const workoutTemplates: Record<string, any> = {
      vo2max: {
        title: 'VO2max 6x800m',
        workout_type: 'interval',
        description: `🏃 **Treino de VO2max**\n\n**Aquecimento:** 15min em ritmo leve (~${paces.easy} min/km)\n\n**Principal:** 6x800m @ ${paces.interval} min/km\n- Zona de FC: Z5 (${zones.z5.min}-${zones.z5.max} bpm)\n- Recuperação: 2min trote leve entre tiros\n\n**Desaquecimento:** 10min em ritmo leve\n\n📊 Distância total: ~10km\n⏱️ Duração estimada: ~55min`,
        distance_meters: 10000
      },
      threshold: {
        title: 'Limiar 3x10min',
        workout_type: 'threshold',
        description: `🏃 **Treino de Limiar**\n\n**Aquecimento:** 15min em ritmo leve (~${paces.easy} min/km)\n\n**Principal:** 3x10min @ ${paces.threshold} min/km\n- Zona de FC: Z4 (${zones.z4.min}-${zones.z4.max} bpm)\n- Recuperação: 3min trote entre blocos\n\n**Desaquecimento:** 10min em ritmo leve\n\n📊 Distância total: ~12km\n⏱️ Duração estimada: ~60min`,
        distance_meters: 12000
      },
      tempo: {
        title: 'Tempo Run 8km',
        workout_type: 'tempo',
        description: `🏃 **Corrida Tempo**\n\n**Aquecimento:** 10min em ritmo leve (~${paces.easy} min/km)\n\n**Principal:** 8km contínuos @ ${paces.tempo} min/km\n- Zona de FC: Z3-Z4 (${zones.z3.min}-${zones.z4.max} bpm)\n- Mantenha ritmo constante\n\n**Desaquecimento:** 10min em ritmo leve\n\n📊 Distância total: ~12km\n⏱️ Duração estimada: ~60min`,
        distance_meters: 12000
      },
      long_run: {
        title: 'Longão 18km',
        workout_type: 'long_run',
        description: `🏃 **Longão Aeróbico**\n\n**Objetivo:** Desenvolver resistência aeróbica\n\n**Execução:** 18km @ ${paces.easy} min/km\n- Zona de FC: Z2 (${zones.z2.min}-${zones.z2.max} bpm)\n- Primeiros 5km bem tranquilos\n- Últimos 3km pode acelerar levemente se sentir bem\n\n📊 Distância: 18km\n⏱️ Duração estimada: ~2h`,
        distance_meters: 18000
      },
      recovery: (() => {
        const dur = args.duration_minutes || 35;
        const distKm = Math.round(dur / 7 * 10) / 10; // ~7 min/km pace for recovery
        const distM = Math.round(distKm * 1000);
        return {
          title: `Regenerativo ${distKm}km`,
          workout_type: 'easy',
          description: `🏃 **Corrida Regenerativa**\n\n**Objetivo:** Recuperação ativa\n\n**Execução:** ${distKm}km muito leve\n- Pace: mais lento que ${paces.easy} min/km\n- Zona de FC: Z1-Z2 (${zones.z1.min}-${zones.z2.max} bpm)\n- Sem esforço, apenas movimento\n\n📊 Distância: ${distKm}km\n⏱️ Duração: ~${dur}min`,
          distance_meters: distM
        };
      })(),
      speed: {
        title: 'Velocidade 8x400m',
        workout_type: 'interval',
        description: `🏃 **Treino de Velocidade**\n\n**Aquecimento:** 15min incluindo 4 acelerações de 80m\n\n**Principal:** 8x400m @ ${paces.repetition} min/km\n- Zona de FC: Z5 (${zones.z5.min}-${hrMax} bpm)\n- Recuperação: 90s caminhada/trote\n\n**Desaquecimento:** 10min em ritmo leve\n\n📊 Distância total: ~8km\n⏱️ Duração estimada: ~50min`,
        distance_meters: 8000
      },
      fartlek: {
        title: 'Fartlek 45min',
        workout_type: 'fartlek',
        description: `🏃 **Fartlek Livre**\n\n**Aquecimento:** 10min em ritmo leve\n\n**Principal (25min):** Alterne livremente:\n- Tiros de 1-3min @ ${paces.interval}-${paces.tempo} min/km (Z4-Z5)\n- Recuperações de 1-2min @ ${paces.easy} min/km (Z2)\n- Ouça seu corpo!\n\n**Desaquecimento:** 10min em ritmo leve\n\n📊 Distância: ~8-10km\n⏱️ Duração: 45min`,
        distance_meters: 9000
      },
      progressive: {
        title: 'Progressivo 10km',
        workout_type: 'tempo',
        description: `🏃 **Corrida Progressiva**\n\n**Estrutura:** 10km com aumento gradual de ritmo\n\n- Km 1-3: ${paces.easy} min/km (Z2)\n- Km 4-6: ${paces.tempo} min/km (Z3)\n- Km 7-9: ${paces.threshold} min/km (Z4)\n- Km 10: ${paces.interval} min/km (Z5) - sprint final!\n\n📊 Distância: 10km\n⏱️ Duração estimada: ~50min`,
        distance_meters: 10000
      }
    };
    
    const template = workoutTemplates[args.workout_category] || workoutTemplates.vo2max;
    
    // Deduplicacao: verificar se ja existe treino com mesmo titulo para a data
    const { data: existing } = await sb.from('training_plan_workouts')
      .select('id, title, workout_date, description')
      .eq('user_id', uid)
      .eq('workout_date', args.date)
      .eq('title', template.title)
      .eq('status', 'planned')
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        success: true,
        already_exists: true,
        workout: { title: existing.title, date: existing.workout_date, description: existing.description },
        message: `Treino "${existing.title}" ja existe para ${args.date}. Nao criei duplicata.`
      };
    }

    const { error } = await sb.from('training_plan_workouts').insert({
      plan_id: plan.id,
      user_id: uid,
      workout_date: args.date,
      workout_type: template.workout_type,
      title: template.title,
      description: template.description,
      distance_meters: template.distance_meters,
      target_hr_zone: args.workout_category === 'recovery' ? 2 : args.workout_category === 'long_run' ? 2 : 4,
      status: 'planned'
    });
    
    if (error) return { success: false, error: 'Falha ao criar treino' };
    return { success: true, workout: { title: template.title, date: args.date, description: template.description } };
  }
  
  if (name === "mark_workout_complete") {
    const { data: w } = await sb.from('training_plan_workouts').select('id, title').eq('user_id', uid).eq('workout_date', args.workout_date).eq('status', 'planned').maybeSingle();
    if (!w) return { success: false, error: 'Treino não encontrado' };
    await sb.from('training_plan_workouts').update({ status: 'completed' }).eq('id', w.id);
    return { success: true, message: `"${w.title}" concluído!` };
  }
  
  if (name === "cancel_training_plan") {
    const sportType = args.sport_type?.toLowerCase();
    const validSports = ['running', 'cycling', 'swimming', 'strength'];
    if (!validSports.includes(sportType)) return { success: false, error: 'Esporte inválido. Use: running, cycling, swimming ou strength' };
    
    const { data: plan, error: fetchError } = await sb.from('training_plans').select('id, plan_name, sport_type, start_date, end_date').eq('user_id', uid).eq('sport_type', sportType).eq('status', 'active').maybeSingle();
    if (fetchError) return { success: false, error: 'Erro ao buscar plano' };
    if (!plan) return { success: false, error: `Nenhum plano de ${sportType} ativo encontrado` };
    
    const { error: updateError } = await sb.from('training_plans').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', plan.id);
    if (updateError) return { success: false, error: 'Falha ao cancelar plano' };
    
    return { success: true, message: `Plano de ${sportType} "${plan.plan_name || 'Sem nome'}" cancelado com sucesso`, cancelled_plan: { id: plan.id, name: plan.plan_name, sport: plan.sport_type, start_date: plan.start_date, end_date: plan.end_date }, reason: args.reason || 'Solicitado pelo atleta' };
  }
  
  if (name === "get_monthly_summary") {
    const year = args.year;
    const month = args.month; // 1-12
    // Current month dates
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    // Previous month dates
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

    const { data, error } = await sb.rpc('weekly_summary_stats_v2', {
      start_date: startDate,
      end_date: endDate,
      previous_start_date: prevStart,
      previous_end_date: prevEnd
    });

    if (error) return { found: false, reason: `Erro ao buscar resumo mensal: ${error.message}` };
    if (!data?.length) return { found: false, reason: `Nenhuma atividade encontrada em ${month}/${year}` };

    // Filter for the current user
    const row = (data as any[]).find((r: any) => r.user_id === uid);
    if (!row) return { found: false, reason: `Nenhuma atividade encontrada em ${month}/${year}` };

    const monthNames = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return {
      found: true,
      period: `${monthNames[month]} ${year}`,
      total_km: row.total_km ? Number(row.total_km).toFixed(1) : null,
      activities_count: row.activities_count || 0,
      active_days: row.active_days || 0,
      total_hours: row.total_hours ? Number(row.total_hours).toFixed(1) : null,
      calories: row.calories || null,
      avg_pace_min_km: row.avg_pace_min_km ? Number(row.avg_pace_min_km).toFixed(2) : null,
      best_pace_min_km: row.best_pace_min_km ? Number(row.best_pace_min_km).toFixed(2) : null,
      avg_heart_rate: row.avg_heart_rate ? Math.round(row.avg_heart_rate) : null,
      max_heart_rate: row.max_heart_rate_week ? Math.round(row.max_heart_rate_week) : null,
      total_elevation_gain: row.total_elevation_gain ? Math.round(row.total_elevation_gain) : null,
      longest_distance_km: row.longest_distance_km ? Number(row.longest_distance_km).toFixed(1) : null,
      activity_types: row.activity_types || {},
      consistency_score: row.consistency_score || null,
      vs_previous_month: {
        distance_change_percent: row.distance_change_percent ? Number(row.distance_change_percent).toFixed(1) : null,
        activities_change: row.activities_change || null,
        prev_total_km: row.prev_total_km ? Number(row.prev_total_km).toFixed(1) : null
      }
    };
  }

  return { error: 'Tool desconhecida' };
}

function buildPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `Você é o BioPeak Coach IA — treinador especialista em corrida e triathlon com acesso direto às APIs e tabelas do BioPeak. DATA ATUAL: ${today}

== 0. PRINCÍPIOS GERAIS ==
1. Confiança > tudo: nunca invente números. Só cite métricas se disponíveis e validadas via tools.
2. Contexto contínuo: se o usuário já liberou acesso na conversa, não repita o pedido.
3. Ação concreta: sempre que possível, execute (criar treino, reagendar, cancelar) e confirme com detalhes.
4. Modo curto: máximo 120 palavras por resposta. Estruture em bullets/emoji discretos.
5. Fonte clara: mencione de onde veio o dado ("VO2max medido em 05/02/26", "treino de 06/02 no Garmin").

== 1. DADOS E SANIDADE ==
REGRA DE OURO: Antes de responder, SEMPRE consulte os dados via tools:
- Estado físico/fadiga/TSB → get_fitness_scores (CTL, ATL, TSB)
- VO2max, paces, zonas → get_athlete_metrics
- Planos ativos → get_training_plan
- Última atividade → get_last_activity ou get_activity_by_date

SANIDADE DE DADOS:
- CTL/ATL fora de 0–200 = inválido → trate como "indisponível"
- TSB > 250 ou negativo extremo = dado corrompido → informe ao usuário
- Se endpoint retornar vazio/erro: "Não consegui puxar [dado] agora (erro [código]). Posso tentar novamente?"
- Nunca sumarize meses percorrendo dia a dia — use somente funções agregadoras

== 2. AÇÕES SUPORTADAS ==
CRIAR TREINO:
1) get_athlete_metrics → 2) create_scientific_workout (SEMPRE passe duration_minutes se o atleta pediu tempo específico, ex: "20 minutos" → duration_minutes: 20) → 3) Retorne briefing completo (aquecimento, séries, pace alvo, objetivo fisiológico)
Tipos aceitos: vo2max / threshold / tempo / long_run / recovery / speed / fartlek / progressive

REAGENDAR/CANCELAR TREINO:
1) get_training_plan → 2) Confirmar com atleta → 3) reschedule_workout ou cancel_training_plan → 4) Sugerir próximos passos
NUNCA cancele sem buscar o ID exato via get_training_plan primeiro.

APAGAR DUPLICADO:
Busque pelo ID exato; se não encontrar, explique e ofereça correção manual.

== 3. FLUXO DE CONVERSA ==
CHECAGEM INICIAL:
- Intenção = análise mensal/evolução ("janeiro", "como foi meu mês", "performance em X") → get_monthly_summary (OBRIGATÓRIO — nunca use get_activity_by_date para períodos)
- Intenção = estado físico (fadiga, VO2, fitness score, CTL/ATL) → get_fitness_scores + get_athlete_metrics
- Intenção = treino específico → get_last_activity ou get_activity_by_date

FORMATO DE RESPOSTA (use quando aplicável):
📊 Resumo — 2 frases com número + interpretação
💡 Insights — bullets com alertas e observações
✅ Próximos passos — proponha ação concreta

FOLLOW-UP AUTOMÁTICO:
- TSB > +25 → "Você está muito descansado — hora de estimular."
- TSB < -25 → "Carga acumulada alta — priorize recuperação hoje."
- CTL subindo/caindo >15% vs mês anterior → destaque a tendência
- Usuário perguntar sobre "meu mês" → ofereça: "Quer que eu crie um relatório em PDF?"

== 4. TOOLS DISPONÍVEIS ==
- get_monthly_summary(year, month) → ÚNICA tool para análise mensal/periódica (obrigatória para "janeiro", "fevereiro", "meu mês")
- get_fitness_scores → CTL, ATL, TSB — já sanitizados no código (valores >200 retornam "indisponível")
- get_athlete_metrics → VO2max, paces, zonas de FC e ritmo
- get_training_plan → planos ativos (running/cycling/swimming/strength)
- get_last_activity / get_activity_by_date → atividades recentes (dia específico apenas)
- create_scientific_workout → cria treino estruturado
- reschedule_workout → reagenda treino por ID
- cancel_training_plan → cancela plano por ID
- get_sleep_data → dados de sono (use proativamente se relevante)

== 5. RESTRIÇÕES E TOM DE VOZ ==
- Português do Brasil sempre. Termos técnicos: pace, TSB, CTL, ATL, VO2max, limiar.
- Tom: técnico mas próximo — como treinador experiente de elite.
- PROIBIDO: clichês motivacionais vazios ("Você consegue!", "Acredite em você!").
- Use dados para embasar cada recomendação.
- Nunca invente treinos sem consultar get_athlete_metrics primeiro.
- Nunca pergunte o que você pode descobrir via tool ("Qual distância você correu?" é errado).`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    await checkRateLimit(user.id, sb);

    const { message, conversationHistory = [], conversationId: reqConvId } = await req.json();
    if (!message) throw new Error('Message required');

    const convId = reqConvId || crypto.randomUUID();
    let history = conversationHistory;
    
    if (reqConvId && !history.length) {
      const { data: prev } = await sb.from('ai_coach_conversations').select('role, content').eq('conversation_id', reqConvId).order('created_at', { ascending: false }).limit(20);
      if (prev?.length) history = prev.reverse().map((m: any) => ({ role: m.role, content: m.content }));
    }

    await sb.from('ai_coach_conversations').insert({ user_id: user.id, conversation_id: convId, role: 'user', content: message });

    let msgs: any[] = [{ role: 'system', content: buildPrompt() }, ...history, { role: 'user', content: message }];
    let finalResp: string | null = null;
    let tokens = 0;
    const toolLog: any[] = [];

    const startTime = Date.now();
    for (let i = 0; i < MAX_ITERATIONS && !finalResp; i++) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        finalResp = "Processamento complexo demais. Tente uma pergunta mais específica.";
        break;
      }
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}` },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: msgs, tools: coachTools, tool_choice: 'auto', max_completion_tokens: 1500 })
      });
      if (!res.ok) throw new Error(`AI error: ${res.status}`);
      const data = await res.json();
      tokens += data.usage?.total_tokens || 0;
      const am = data.choices[0].message;

      if (am.tool_calls?.length) {
        msgs.push(am);
        for (const tc of am.tool_calls) {
          const toolStart = Date.now();
          const args = JSON.parse(tc.function.arguments || '{}');
          const result = await executeTool(tc.function.name, args, sb, user.id);
          toolLog.push({ tool: tc.function.name, args, execution_ms: Date.now() - toolStart, success: !result.error });
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      } else {
        finalResp = am.content;
      }
    }

    if (!finalResp) finalResp = 'Desculpe, não consegui processar sua solicitação.';

    await sb.from('ai_coach_conversations').insert({ user_id: user.id, conversation_id: convId, role: 'assistant', content: finalResp, context_used: { tools: toolLog }, tokens_used: tokens });

    const { data: sess } = await sb.from('ai_coach_conversation_sessions').select('*').eq('id', convId).single();
    if (sess) {
      await sb.from('ai_coach_conversation_sessions').update({ last_message_at: new Date().toISOString(), message_count: sess.message_count + 2, total_tokens_used: (sess.total_tokens_used || 0) + tokens }).eq('id', convId);
    } else {
      await sb.from('ai_coach_conversation_sessions').insert({ id: convId, user_id: user.id, title: message.slice(0, 50), last_message_at: new Date().toISOString(), message_count: 2, total_tokens_used: tokens });
    }

    return new Response(JSON.stringify({ response: finalResp, conversationId: convId, tokensUsed: tokens }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('AI Coach Error:', { error: e.message, stack: e.stack });
    
    let userMessage = 'Desculpe, ocorreu um erro. Tente novamente.';
    let status = 500;
    
    if (e.message === 'RATE_LIMIT') {
      userMessage = 'Você atingiu o limite de mensagens. Aguarde 5 minutos.';
      status = 429;
    } else if (e.message === 'Not authenticated') {
      userMessage = 'Sessão expirada. Faça login novamente.';
      status = 401;
    } else if (e.message.includes('AI error')) {
      userMessage = 'Serviço de IA indisponível. Tente em alguns instantes.';
      status = 503;
    }
    
    return new Response(JSON.stringify({ error: userMessage }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
