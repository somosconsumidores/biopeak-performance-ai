import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      vo2max: vo2MaxCurrent
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

    const prompt = `Gere um briefing diário de até ~200 palavras para o atleta, baseado nos dados abaixo. Inclua: (1) como está a recuperação (sono), (2) qual treino do dia e intensidade por zona, (3) justificativa curta e (4) uma dica prática. Evite jargões excessivos.

DADOS:
- Data: ${parts.date}
- Sono última noite: score ${parts.sleep.last?.score ?? 'n/d'}, duração ${parts.sleep.last?.duration_min ?? 'n/d'} min
- Sono média 7d: ${parts.sleep.avg7d ?? 'n/d'}
- Carga 7d: ${parts.load7d.distance_km} km, ${parts.load7d.duration_min} min
- VO2max atual: ${parts.vo2max ?? 'n/d'}

Responda em JSON com os campos: briefing, suggested_workout, rationale.`;

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
    const content: string = aiJson.choices[0].message.content;

    let parsed: { briefing: string; suggested_workout?: string; rationale?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { briefing: content } as any;
    }

    const payload = {
      date: todayStr,
      ...parsed,
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
