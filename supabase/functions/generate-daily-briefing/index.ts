import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header provided');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) throw new Error('Invalid authentication token');

    console.log(`🗓️ Generating daily briefing for user ${user.id.substring(0,8)}...`);

    const today = new Date();
    const todayStr = today.toISOString().slice(0,10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0,10);

    // Sleep - last night and 7-day avg
    const { data: lastSleep } = await supabase
      .from('garmin_sleep_summaries')
      .select('calendar_date, sleep_score, sleep_time_in_seconds, deep_sleep_duration_in_seconds, rem_sleep_duration_in_seconds, light_sleep_duration_in_seconds')
      .eq('user_id', user.id)
      .order('calendar_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: sleepWeek } = await supabase
      .from('garmin_sleep_summaries')
      .select('sleep_score')
      .eq('user_id', user.id)
      .gte('calendar_date', sevenDaysAgoStr);

    const sleepWeekScores = (sleepWeek || []).map(s => Number(s.sleep_score)).filter(v => !!v && isFinite(v));
    const avgSleep7d = sleepWeekScores.length ? Math.round(sleepWeekScores.reduce((a,b)=>a+b,0) / sleepWeekScores.length) : null;

    // Training load - last 7 days (from all_activities)
    const { data: weekActs } = await supabase
      .from('all_activities')
      .select('activity_date, total_distance_meters, total_time_minutes, average_heart_rate')
      .eq('user_id', user.id)
      .gte('activity_date', sevenDaysAgoStr);

    const totalKm7d = (weekActs||[]).reduce((acc, r) => acc + (Number(r.total_distance_meters)||0), 0) / 1000;
    const totalMin7d = (weekActs||[]).reduce((acc, r) => acc + (Number(r.total_time_minutes)||0), 0);

    // VO2max current
    let vo2MaxCurrent: number | null = null;
    const { data: mapping } = await supabase
      .from('garmin_user_mapping')
      .select('garmin_user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mapping?.garmin_user_id) {
      const { data: vo2 } = await supabase
        .from('garmin_vo2max')
        .select('vo2_max_running, calendar_date')
        .eq('garmin_user_id', mapping.garmin_user_id)
        .order('calendar_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      vo2MaxCurrent = vo2?.vo2_max_running ?? null;
    }

    // Fetch active training plan
    const { data: activePlan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let todayWorkout = null;
    if (activePlan) {
      const { data: workouts } = await supabase
        .from('training_plan_workouts')
        .select('*')
        .eq('plan_id', activePlan.id)
        .eq('workout_date', todayStr)
        .maybeSingle();
      
      todayWorkout = workouts;
    }

    // Compose prompt
    const parts = {
      date: todayStr,
      sleep: {
        last: lastSleep ? {
          date: lastSleep.calendar_date,
          score: lastSleep.sleep_score,
          duration_min: Math.round((Number(lastSleep.sleep_time_in_seconds)||0) / 60),
          deep_min: Math.round((Number(lastSleep.deep_sleep_duration_in_seconds)||0) / 60),
          rem_min: Math.round((Number(lastSleep.rem_sleep_duration_in_seconds)||0) / 60),
        } : null,
        avg7d: avgSleep7d
      },
      load7d: {
        distance_km: Math.round(totalKm7d * 10) / 10,
        duration_min: Math.round(totalMin7d)
      },
      vo2max: vo2MaxCurrent,
      activePlan: activePlan ? {
        name: activePlan.plan_name,
        goal: activePlan.goal_type,
        weeks: activePlan.duration_weeks
      } : null,
      todayWorkout: todayWorkout ? {
        type: todayWorkout.workout_type,
        title: todayWorkout.title,
        description: todayWorkout.description,
        duration_min: todayWorkout.duration_minutes,
        distance_km: todayWorkout.distance_meters ? (todayWorkout.distance_meters / 1000) : null
      } : null
    };

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.log('⚠️ OPENAI_API_KEY missing, returning mock briefing');
      return new Response(
        JSON.stringify({
          date: todayStr,
          briefing: `Bom dia! Seu score de sono foi ${parts.sleep.last?.score ?? 'n/d'}. Na última semana você acumulou ${parts.load7d.distance_km} km em ${parts.load7d.duration_min} minutos. Sugestão: corrida leve de 30-40 min em Zona 2 para consolidar a recuperação.`,
          suggested_workout: 'Corrida leve 30-40 min (Zona 2)',
          rationale: 'Sono e carga recente indicam manutenção de base aeróbica e recuperação ativa.',
          keyMetrics: parts
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Gere um briefing diário compacto (≤ 800 caracteres) para o atleta com base nos dados abaixo. Saída em JSON VÁLIDO, sem markdown, sem crases, sem emojis, apenas JSON. Campos exigidos:

{
  "briefing": "texto simples sem markdown nem emojis",
  "rationale": "texto simples curto",
  "workout": {
    "sport": "running|cycling|strength",
    "duration_min": number,
    "intensity": "easy|moderate|hard",
    "guidance": {
      "primary": "pace|hr",
      "pace_min_per_km": { "min": "MM:SS", "max": "MM:SS" } | null,
      "hr_bpm": { "min": number, "max": number } | null,
      "hr_zone": "Z1|Z2|Z3|Z4|Z5" | null
    },
    "structure": [
      { "name": "Aquecimento", "minutes": 10, "intensity": "easy" },
      { "name": "Bloco Principal", "minutes": 25, "intensity": "moderate" },
      { "name": "Desaquecimento", "minutes": 10, "intensity": "easy" }
    ]
  }
}

Regras:
- O briefing deve mencionar a recuperação (sono) e a carga recente.
- CRÍTICO: Se o atleta tem um plano de treino ativo e há treino agendado para hoje, o workout deve corresponder EXATAMENTE ao treino agendado. Se não houver treino agendado ou plano ativo, sugira um treino apropriado.
- O treino do dia deve estar concretamente especificado: esporte, duração e FAIXA de intensidade por pace (min/km) e/ou faixa de FC (bpm) ou zona (Z1–Z5).
- Ajuste a intensidade considerando o sono da última noite, média 7d e carga 7d.
- Se faltarem dados, use valores conservadores e seja explícito.

DADOS:
- Data: ${parts.date}
- Sono última noite: score ${parts.sleep.last?.score ?? 'n/d'}, duração ${parts.sleep.last?.duration_min ?? 'n/d'} min
- Sono média 7d: ${parts.sleep.avg7d ?? 'n/d'}
- Carga 7d: ${parts.load7d.distance_km} km, ${parts.load7d.duration_min} min
- VO2max atual: ${parts.vo2max ?? 'n/d'}
- Plano de treino ativo: ${parts.activePlan ? `${parts.activePlan.name} (${parts.activePlan.goal}, ${parts.activePlan.weeks} semanas)` : 'nenhum'}
- Treino agendado hoje: ${parts.todayWorkout ? `${parts.todayWorkout.type} - ${parts.todayWorkout.title}${parts.todayWorkout.duration_min ? `, ${parts.todayWorkout.duration_min}min` : ''}${parts.todayWorkout.distance_km ? `, ${parts.todayWorkout.distance_km}km` : ''}` : 'nenhum'}`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um coach de corrida objetivo e motivador.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 800
      })
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error('OpenAI error:', txt);
      throw new Error('Failed to generate daily briefing');
    }

    const aiJson = await aiRes.json();
    const rawContent: string = aiJson.choices?.[0]?.message?.content ?? '';

    // Extract clean JSON (handle code fences or extra text)
    const fencedClean = rawContent.replace(/```json|```/gi, '').trim();
    const jsonMatch = fencedClean.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : fencedClean;

    let parsed: any = {};
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse AI JSON, using raw text as briefing');
      parsed = { briefing: rawContent };
    }

    const cleanText = (s?: string) =>
      (s ?? '')
        .replace(/[*_`~>#\-+|]/g, ' ')
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '') // remove emojis
        .replace(/[\u0000-\u001F\u007F]/g, ' ') // control chars
        .replace(/\s{2,}/g, ' ')
        .trim();

    const workout = parsed.workout ?? null;
    const suggestedFromWorkout = workout
      ? `${workout.sport || 'corrida'} ${workout.duration_min ? `${workout.duration_min} min` : ''} ${workout.intensity ? `(${workout.intensity})` : ''}` +
        `${workout?.guidance?.pace_min_per_km?.min && workout?.guidance?.pace_min_per_km?.max
            ? `, pace ${workout.guidance.pace_min_per_km.min}-${workout.guidance.pace_min_per_km.max} min/km`
            : ''}` +
        `${workout?.guidance?.hr_bpm?.min && workout?.guidance?.hr_bpm?.max
            ? `, FC ${workout.guidance.hr_bpm.min}-${workout.guidance.hr_bpm.max} bpm`
            : workout?.guidance?.hr_zone ? `, ${workout.guidance.hr_zone}` : ''}`
      : undefined;

    const payload = {
      date: todayStr,
      briefing: cleanText(parsed.briefing),
      suggested_workout: cleanText(parsed.suggested_workout) || suggestedFromWorkout,
      rationale: cleanText(parsed.rationale),
      workout,
      keyMetrics: parts
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('❌ generate-daily-briefing error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
