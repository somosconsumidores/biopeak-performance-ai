
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user ID from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { raceId } = await req.json();

    // Get race details
    const { data: race, error: raceError } = await supabase
      .from('user_target_races')
      .select('*')
      .eq('id', raceId)
      .eq('user_id', user.id)
      .single();

    if (raceError || !race) {
      return new Response(JSON.stringify({ error: 'Race not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's activities from last 90 days
    const { data: activities } = await supabase
      .from('all_activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('activity_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('activity_date', { ascending: false });

    // Filter running activities
    const runningActivities = activities?.filter(a => 
      a.activity_type?.toLowerCase().includes('run') && 
      a.pace_min_per_km && 
      a.total_distance_meters && 
      a.total_time_minutes
    ) || [];

    if (runningActivities.length === 0) {
      return new Response(JSON.stringify({
        error: 'Dados insuficientes para análise',
        ai_comment: 'Você precisa ter pelo menos algumas corridas registradas para que eu possa analisar seu objetivo.'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate metrics
    const paces = runningActivities.map(a => a.pace_min_per_km).sort((a, b) => a - b);
    const paceBest = paces[0];
    const paceMedian = paces[Math.floor(paces.length / 2)];
    
    const longestRunKm = Math.max(...runningActivities.map(a => a.total_distance_meters / 1000));
    
    // Weekly patterns for last 8 weeks
    const weekKey = (d: Date) => {
      const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = dt.getUTCDay() || 7;
      dt.setUTCDate(dt.getUTCDate() - (day - 1));
      return dt.toISOString().slice(0, 10);
    };

    const now = new Date();
    const cutoff = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000); // 8 weeks
    const byWeek = new Map();
    
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

    // Calculate race estimate using Riegel formula
    const riegel = (t1: number, d1: number, d2: number, exp = 1.06) => t1 * Math.pow(d2 / d1, exp);
    const raceDistanceKm = race.distance_meters / 1000;
    
    // Use median pace for 5k as baseline
    const base5kTimeMin = paceMedian * 5;
    let estimatedTimeMinutes = 0;
    
    if (raceDistanceKm >= 40) {
      estimatedTimeMinutes = riegel(base5kTimeMin, 5, 42.195);
    } else if (raceDistanceKm >= 20) {
      estimatedTimeMinutes = riegel(base5kTimeMin, 5, 21.097);
    } else if (raceDistanceKm >= 9) {
      estimatedTimeMinutes = riegel(base5kTimeMin, 5, 10);
    } else {
      estimatedTimeMinutes = paceMedian * raceDistanceKm;
    }

    const targetTimeMinutes = race.target_time_minutes || estimatedTimeMinutes;
    const timeGapMinutes = estimatedTimeMinutes - targetTimeMinutes;
    const timeGapPercent = (timeGapMinutes / targetTimeMinutes) * 100;

    // Create AI prompt
    const formatTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = Math.floor(minutes % 60);
      return h > 0 ? `${h}:${m.toString().padStart(2, '0')}h` : `${m}min`;
    };

    const prompt = `
Você é um treinador de corrida experiente. Analise os dados abaixo e escreva um parecer motivador e didático para o atleta:

PROVA ALVO:
- Nome: ${race.race_name}
- Distância: ${raceDistanceKm}km
- Meta do atleta: ${formatTime(targetTimeMinutes)}
- Estimativa atual: ${formatTime(estimatedTimeMinutes)}
- Gap: ${timeGapMinutes > 0 ? '+' : ''}${timeGapMinutes.toFixed(1)} min (${timeGapPercent.toFixed(1)}%)

HISTÓRICO DO ATLETA (últimas ${runningActivities.length} corridas):
- Pace mediano: ${paceMedian.toFixed(2)} min/km
- Melhor pace: ${paceBest.toFixed(2)} min/km
- Corrida mais longa: ${longestRunKm.toFixed(1)}km
- Volume semanal médio: ${avgWeeklyDistanceKm.toFixed(1)}km
- Frequência semanal: ${avgWeeklyFrequency.toFixed(1)} treinos

💡 Escreva um parecer em português brasileiro que inclua:
1. Uma análise dos pontos fortes do atleta
2. Os principais gaps que precisam ser trabalhados
3. 3 recomendações práticas e específicas de treino
4. Uma mensagem motivadora para o objetivo

Seja direto, prático e encorajador. Use linguagem acessível.
`;

    // Call OpenAI
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

    const aiData = await response.json();
    const aiComment = aiData.choices?.[0]?.message?.content || 'Não foi possível gerar a análise no momento.';

    // Save to database
    await supabase
      .from('race_progress_snapshots')
      .insert({
        race_id: raceId,
        user_id: user.id,
        estimated_time_minutes: Math.round(estimatedTimeMinutes),
        fitness_level: avgWeeklyDistanceKm >= 40 ? 'advanced' : avgWeeklyDistanceKm >= 20 ? 'intermediate' : 'beginner',
        readiness_score: Math.min(Math.round((avgWeeklyDistanceKm / 30) * 50 + (avgWeeklyFrequency / 4) * 30 + (paceBest <= 5 ? 20 : 10)), 100),
        gap_analysis: {
          target_time_minutes: targetTimeMinutes,
          estimated_time_minutes: Math.round(estimatedTimeMinutes),
          gap_minutes: timeGapMinutes,
          gap_percentage: timeGapPercent,
          distance_km: raceDistanceKm
        },
        training_focus_areas: ['pacing', 'endurance', 'consistency'],
        ai_analysis: aiComment
      });

    return new Response(JSON.stringify({
      ai_comment: aiComment,
      estimated_time_minutes: Math.round(estimatedTimeMinutes),
      gap_analysis: {
        target_time_minutes: targetTimeMinutes,
        gap_minutes: timeGapMinutes,
        gap_percentage: timeGapPercent
      }
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
