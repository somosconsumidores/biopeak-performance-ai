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
  { type: "function", function: { name: "reschedule_workout", description: "Move treino para outra data", parameters: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" }, strategy: { type: "string", enum: ["swap", "replace", "push"] } }, required: ["from_date", "to_date"], additionalProperties: false } } },
  { type: "function", function: { name: "create_custom_workout", description: "Cria treino", parameters: { type: "object", properties: { date: { type: "string" }, workout_type: { type: "string" }, title: { type: "string" }, description: { type: "string" } }, required: ["date", "workout_type", "title", "description"], additionalProperties: false } } },
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
  if (name === "create_custom_workout") {
    const { data: plan } = await sb.from('training_plans').select('id').eq('user_id', uid).eq('status', 'active').maybeSingle();
    if (!plan) return { success: false, error: 'Sem plano ativo' };
    const { error } = await sb.from('training_plan_workouts').insert({ plan_id: plan.id, user_id: uid, workout_date: args.date, workout_type: args.workout_type, title: args.title, description: args.description, status: 'planned' });
    return error ? { success: false, error: 'Falha' } : { success: true, message: `Treino "${args.title}" criado` };
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
  return `Você é o BioPeak AI Coach. DATA: ${today}

REGRA: Use tools para buscar dados - NUNCA peça ao usuário!
- get_last_activity: última atividade
- get_training_plan: próximos treinos
- get_sleep_data: sono
- get_fitness_scores: CTL/ATL/TSB
- reschedule_workout: mover treino
- create_custom_workout: criar treino
- mark_workout_complete: marcar feito

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
