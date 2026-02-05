import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const MAX_ITERATIONS = 5;

const coachTools = [
  { type: "function", function: { name: "get_last_activity", description: "Busca última atividade com pace, FC, distância", parameters: { type: "object", properties: { activity_type: { type: "string", description: "RUNNING, CYCLING, etc" } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_activity_by_date", description: "Atividade em data específica", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"], additionalProperties: false } } },
  { type: "function", function: { name: "get_training_plan", description: "Plano ativo e próximos treinos", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_sleep_data", description: "Dados de sono", parameters: { type: "object", properties: { days: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_fitness_scores", description: "CTL, ATL, TSB", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_athlete_metrics", description: "Busca métricas do atleta: VO2max, paces de referência, FC máxima, zonas. SEMPRE use antes de criar treinos científicos.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "reschedule_workout", description: "Move treino para outra data", parameters: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" }, strategy: { type: "string", enum: ["swap", "replace", "push"] } }, required: ["from_date", "to_date"], additionalProperties: false } } },
  { type: "function", function: { name: "create_scientific_workout", description: "Cria treino científico com paces e estrutura detalhada baseado nas métricas do atleta", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, workout_category: { type: "string", enum: ["vo2max", "threshold", "tempo", "long_run", "recovery", "speed", "fartlek", "progressive"], description: "Tipo de treino" }, athlete_metrics: { type: "object", description: "Métricas do atleta obtidas via get_athlete_metrics" } }, required: ["date", "workout_category"], additionalProperties: false } } },
  { type: "function", function: { name: "mark_workout_complete", description: "Marca treino concluído", parameters: { type: "object", properties: { workout_date: { type: "string" } }, required: ["workout_date"], additionalProperties: false } } }
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
    const { data: plan } = await sb.from('training_plans').select('*').eq('user_id', uid).eq('status', 'active').maybeSingle();
    if (!plan) return { found: false };
    const { data: workouts } = await sb.from('training_plan_workouts').select('id, workout_date, title, workout_type, status').eq('plan_id', plan.id).order('workout_date');
    const today = new Date().toISOString().split('T')[0];
    const upcoming = workouts?.filter((w: any) => w.workout_date >= today && w.status === 'planned') || [];
    return { found: true, plan_name: plan.name || plan.plan_name, upcoming: upcoming.slice(0, 7).map((w: any) => ({ date: w.workout_date, title: w.title, type: w.workout_type })) };
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
    if (!data) return { found: false };
    const tsb = data.ctl_42day && data.atl_7day ? (data.ctl_42day - data.atl_7day) : null;
    return { found: true, ctl: data.ctl_42day?.toFixed(1), atl: data.atl_7day?.toFixed(1), tsb: tsb?.toFixed(1), status: tsb && tsb > 5 ? 'Fresh' : tsb && tsb > -5 ? 'Balanceado' : 'Fadiga' };
  }
  
  // NEW: Get athlete metrics for scientific workout generation
  if (name === "get_athlete_metrics") {
    // Get Garmin tokens for garmin_user_id
    const { data: tokens } = await sb.from('garmin_tokens').select('garmin_user_id').eq('user_id', uid).eq('is_active', true).limit(1);
    const garminUserId = tokens?.[0]?.garmin_user_id;
    
    // Get VO2max from Garmin
    let vo2max = null;
    if (garminUserId) {
      const { data: vo2Data } = await sb.from('garmin_vo2max').select('vo2_max_running, vo2_max_cycling').eq('garmin_user_id', garminUserId).order('calendar_date', { ascending: false }).limit(1).maybeSingle();
      vo2max = vo2Data?.vo2_max_running || vo2Data?.vo2_max_cycling || null;
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
  
  // NEW: Create scientific workout with calculated paces
  if (name === "create_scientific_workout") {
    const { data: plan } = await sb.from('training_plans').select('id').eq('user_id', uid).eq('status', 'active').maybeSingle();
    if (!plan) return { success: false, error: 'Sem plano ativo' };
    
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
      recovery: {
        title: 'Regenerativo 5km',
        workout_type: 'easy',
        description: `🏃 **Corrida Regenerativa**\n\n**Objetivo:** Recuperação ativa\n\n**Execução:** 5km muito leve\n- Pace: mais lento que ${paces.easy} min/km\n- Zona de FC: Z1-Z2 (${zones.z1.min}-${zones.z2.max} bpm)\n- Sem esforço, apenas movimento\n\n📊 Distância: 5km\n⏱️ Duração: ~35min`,
        distance_meters: 5000
      },
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
  return { error: 'Tool desconhecida' };
}

function buildPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `Você é o BioPeak AI Coach - um coach de corrida científico. DATA: ${today}

REGRAS CRÍTICAS para criar treinos:
1. SEMPRE chame get_athlete_metrics PRIMEIRO para obter paces e zonas do atleta
2. Use create_scientific_workout com os dados obtidos para criar treinos personalizados
3. Nunca invente paces - use apenas os dados reais do atleta

TOOLS DISPONÍVEIS:
- get_athlete_metrics: OBRIGATÓRIO antes de criar qualquer treino! Retorna VO2max, paces, FC máx, zonas
- create_scientific_workout: Cria treino científico com estrutura completa (aquecimento, principal, desaquecimento)
  - Categorias: vo2max, threshold, tempo, long_run, recovery, speed, fartlek, progressive
- get_last_activity: última atividade
- get_training_plan: próximos treinos
- get_fitness_scores: CTL/ATL/TSB
- reschedule_workout: mover treino
- mark_workout_complete: marcar feito

FLUXO para criar treino:
1. Chame get_athlete_metrics
2. Chame create_scientific_workout passando athlete_metrics com os dados recebidos
3. Responda mostrando o treino criado com todos os detalhes

Responda em português, cite dados específicos, seja objetivo.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { message, conversationHistory = [], conversationId: reqConvId } = await req.json();
    if (!message) throw new Error('Message required');

    const convId = reqConvId || crypto.randomUUID();
    let history = conversationHistory;
    
    if (reqConvId && !history.length) {
      const { data: prev } = await sb.from('ai_coach_conversations').select('role, content').eq('conversation_id', reqConvId).order('created_at');
      if (prev?.length) history = prev.map((m: any) => ({ role: m.role, content: m.content }));
    }

    await sb.from('ai_coach_conversations').insert({ user_id: user.id, conversation_id: convId, role: 'user', content: message });

    let msgs: any[] = [{ role: 'system', content: buildPrompt() }, ...history, { role: 'user', content: message }];
    let finalResp: string | null = null;
    let tokens = 0;
    const toolLog: any[] = [];

    for (let i = 0; i < MAX_ITERATIONS && !finalResp; i++) {
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
          const args = JSON.parse(tc.function.arguments || '{}');
          const result = await executeTool(tc.function.name, args, sb, user.id);
          toolLog.push({ tool: tc.function.name, args });
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
  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
