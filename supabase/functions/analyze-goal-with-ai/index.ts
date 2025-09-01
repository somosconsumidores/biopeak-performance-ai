
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

// Função para limpar markdown e caracteres especiais da resposta da IA
function cleanAIResponse(text: string): string {
  return text
    // Remover blocos de código ```...```
    .replace(/```[\s\S]*?```/g, '')
    // Remover inline code `...`
    .replace(/`([^`]+)`/g, '$1')
    // Remover headers markdown no início da linha
    .replace(/^#{1,6}\s*/gm, '')
    // Preservar cabeçalhos das seções (PONTOS FORTES, GAPS, etc.), mas remover outros negritos
    .replace(/\*\*(?!(?:PONTOS?\s+FORTES?|GAPS?\s+A?\s+TRABALHAR|RECOMENDAÇ|MENSAGEM|MOTIVAÇ)[^*]*\*\*)(.*?)\*\*/gi, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(?!\*)(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Converter listas - ou * para •
    .replace(/^\s*[-*]\s+/gm, '• ')
    // Converter listas numeradas "1. " para •
    .replace(/^\s*\d+\.\s+/gm, '• ')
    // Normalizar bullets duplicados
    .replace(/^[•\s]+/gm, (m) => m.includes('•') ? '• ' : '')
    // Reduzir múltiplas linhas em no máx 2
    .replace(/\n{3,}/g, '\n\n')
    // Remover espaços em excesso
    .replace(/[ \t]+/g, ' ')
    // Aparar espaços extras por linha
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    // Trim final
    .trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('[analyze-goal-with-ai] Request received');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    console.log('[analyze-goal-with-ai] Authorization header present:', !!authHeader);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.warn('[analyze-goal-with-ai] Unauthorized access attempt', { authError });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('[analyze-goal-with-ai] Authenticated user:', user.id);

    // Agora aceitamos a estimativa oficial do frontend para manter consistência
    const {
      raceId,
      forceRegenerate = false,
      estimated_time_minutes: estimatedFromClient,
      target_time_minutes: targetFromClient
    } = await req.json();
    console.log('[analyze-goal-with-ai] Payload:', { raceId, forceRegenerate, hasClientEstimate: !!estimatedFromClient });

    // Get race details
    const { data: race, error: raceError } = await supabase
      .from('user_target_races')
      .select('*')
      .eq('id', raceId)
      .eq('user_id', user.id)
      .single();

    if (raceError || !race) {
      console.warn('[analyze-goal-with-ai] Race not found or error', { raceError });
      return new Response(JSON.stringify({ error: 'Race not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('[analyze-goal-with-ai] Race loaded:', { race_name: race.race_name, distance_meters: race.distance_meters });

    // Check for cached analysis (last 7 days) unless force regenerate
    if (!forceRegenerate) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: cachedSnapshot, error: cacheError } = await supabase
        .from('race_progress_snapshots')
        .select('*')
        .eq('race_id', raceId)
        .eq('user_id', user.id)
        .not('ai_analysis', 'is', null)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cacheError && cachedSnapshot?.ai_analysis) {
        console.log('[analyze-goal-with-ai] Returning cached analysis');
        return new Response(JSON.stringify({
          ai_comment: cachedSnapshot.ai_analysis,
          estimated_time_minutes: cachedSnapshot.estimated_time_minutes,
          gap_analysis: cachedSnapshot.gap_analysis,
          cached: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Carrega atividades (mantido para contexto ao prompt)
    const { data: activities, error: activitiesError } = await supabase
      .from('all_activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('activity_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('activity_date', { ascending: false });

    if (activitiesError) {
      console.error('[analyze-goal-with-ai] Error loading activities:', activitiesError);
    }

    // Filtra corridas
    const runningActivities = activities?.filter(a => 
      a.activity_type?.toLowerCase().includes('run') && 
      a.pace_min_per_km && 
      a.total_distance_meters && 
      a.total_time_minutes
    ) || [];

    console.log('[analyze-goal-with-ai] Running activities in last 90d:', runningActivities.length);

    if (runningActivities.length === 0) {
      const errorResponse = {
        error: 'Dados insuficientes para análise',
        ai_comment: 'Você precisa ter pelo menos algumas corridas registradas para que eu possa analisar seu objetivo.'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calcula métricas descritivas para o prompt
    const paces = runningActivities.map(a => a.pace_min_per_km).sort((a, b) => a - b);
    const paceBest = paces[0];
    const paceMedian = paces[Math.floor(paces.length / 2)];
    const longestRunKm = Math.max(...runningActivities.map(a => a.total_distance_meters / 1000));

    // Padrões semanais (8 semanas)
    const weekKey = (d: Date) => {
      const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = dt.getUTCDay() || 7;
      dt.setUTCDate(dt.getUTCDate() - (day - 1));
      return dt.toISOString().slice(0, 10);
    };

    const now = new Date();
    const cutoff = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000); // 8 weeks
    const byWeek = new Map<string, { count: number; distanceKm: number }>();
    
    runningActivities.forEach(a => {
      const activityDate = new Date(a.activity_date);
      if (activityDate < cutoff) return;
      const key = weekKey(activityDate);
      const prev = byWeek.get(key) || { count: 0, distanceKm: 0 };
      byWeek.set(key, {
        count: prev.count + 1,
        distanceKm: prev.distanceKm + (a.total_distance_meters / 1000)
      });
    });

    const lastWeeks = Array.from(byWeek.values());
    const avgWeeklyFrequency = lastWeeks.length ? lastWeeks.reduce((s, v) => s + v.count, 0) / lastWeeks.length : 0;
    const avgWeeklyDistanceKm = lastWeeks.length ? lastWeeks.reduce((s, v) => s + v.distanceKm, 0) / lastWeeks.length : 0;

    console.log('[analyze-goal-with-ai] Metrics:', {
      paceBest, paceMedian, longestRunKm,
      avgWeeklyFrequency, avgWeeklyDistanceKm
    });

    // Consistência com o card: prioriza estimativa vinda do frontend
    let estimatedTimeMinutes: number | null = estimatedFromClient ?? null;

    if (estimatedTimeMinutes == null) {
      console.log('[analyze-goal-with-ai] No client estimate; invoking analyze-race-readiness as fallback...');
      const { data: analysisData } = await supabase.functions.invoke('analyze-race-readiness', {
        body: { 
          distance_meters: race.distance_meters,
          target_time_minutes: race.target_time_minutes 
        }
      });
      estimatedTimeMinutes = analysisData?.estimated_time_minutes ?? 0;
    }

    const targetTimeMinutes = (typeof targetFromClient === 'number' && targetFromClient > 0)
      ? targetFromClient
      : (race.target_time_minutes ?? estimatedTimeMinutes ?? 0);

    const timeGapMinutes = (estimatedTimeMinutes ?? 0) - (targetTimeMinutes || 0);
    const timeGapPercent = targetTimeMinutes ? (timeGapMinutes / targetTimeMinutes) * 100 : 0;

    const formatTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = Math.floor(minutes % 60);
      return h > 0 ? `${h}:${m.toString().padStart(2, '0')}h` : `${m}min`;
    };

    const raceDistanceKm = race.distance_meters / 1000;

    const prompt = `
Você é um treinador de corrida experiente. Analise os dados abaixo e escreva um parecer motivador e didático para o atleta:

PROVA ALVO:
- Nome: ${race.race_name}
- Distância: ${raceDistanceKm}km
- Meta do atleta: ${formatTime(targetTimeMinutes || 0)}
- Estimativa atual (oficial do app): ${formatTime(estimatedTimeMinutes || 0)}
- Gap: ${timeGapMinutes > 0 ? '+' : ''}${(timeGapMinutes || 0).toFixed(1)} min (${timeGapPercent.toFixed(1)}%)

HISTÓRICO DO ATLETA (últimas ${runningActivities.length} corridas):
- Pace mediano: ${paceMedian.toFixed(2)} min/km
- Melhor pace: ${paceBest.toFixed(2)} min/km
- Corrida mais longa: ${longestRunKm.toFixed(1)}km
- Volume semanal médio: ${avgWeeklyDistanceKm.toFixed(1)}km
- Frequência semanal: ${avgWeeklyFrequency.toFixed(1)} treinos

💡 Escreva um parecer em português brasileiro seguindo EXATAMENTE esta estrutura com cabeçalhos:

**PONTOS FORTES:**
[Analise os pontos fortes do atleta com base nos dados]

**GAPS A TRABALHAR:**
[Identifique os principais gaps que precisam ser trabalhados]

**RECOMENDAÇÕES:**
[Forneça 3 recomendações práticas e específicas de treino]

**MENSAGEM MOTIVADORA:**
[Uma mensagem motivadora para o objetivo]

Seja direto, prático e encorajador. Use linguagem acessível e evite formatação markdown além dos cabeçalhos em negrito. Use parágrafos bem estruturados.`;

    console.log('[analyze-goal-with-ai] Calling OpenAI gpt-4o-mini...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um treinador de corrida profissional que fornece análises detalhadas e motivadoras para atletas.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errTxt = await response.text();
      console.error('[analyze-goal-with-ai] OpenAI API error:', response.status, errTxt);
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await response.json();
    const rawAiComment = aiData.choices?.[0]?.message?.content || 'Não foi possível gerar a análise no momento.';
    const cleanedAiComment = cleanAIResponse(rawAiComment);
    console.log('[analyze-goal-with-ai] OpenAI response received and cleaned. Length:', cleanedAiComment?.length || 0);

    // Save to database (inclui ai_analysis)
    const snapshotPayload = {
      race_id: raceId,
      user_id: user.id,
      estimated_time_minutes: Math.round(estimatedTimeMinutes || 0),
      fitness_level: avgWeeklyDistanceKm >= 40 ? 'advanced' : avgWeeklyDistanceKm >= 20 ? 'intermediate' : 'beginner',
      readiness_score: Math.min(Math.round((avgWeeklyDistanceKm / 30) * 50 + (avgWeeklyFrequency / 4) * 30 + (paceBest <= 5 ? 20 : 10)), 100),
      gap_analysis: {
        target_time_minutes: targetTimeMinutes || 0,
        estimated_time_minutes: Math.round(estimatedTimeMinutes || 0),
        gap_minutes: timeGapMinutes,
        gap_percentage: timeGapPercent,
        distance_km: raceDistanceKm
      },
      training_focus_areas: ['pacing', 'endurance', 'consistency'],
      ai_analysis: cleanedAiComment
    };

    const { error: insertError } = await supabase
      .from('race_progress_snapshots')
      .insert(snapshotPayload);

    if (insertError) {
      console.error('[analyze-goal-with-ai] Failed to save snapshot:', insertError);
    } else {
      console.log('[analyze-goal-with-ai] Snapshot saved successfully');
    }

    return new Response(JSON.stringify({
      ai_comment: cleanedAiComment,
      estimated_time_minutes: Math.round(estimatedTimeMinutes || 0),
      gap_analysis: {
        target_time_minutes: targetTimeMinutes || 0,
        gap_minutes: timeGapMinutes,
        gap_percentage: timeGapPercent
      },
      cached: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in analyze-goal-with-ai:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
