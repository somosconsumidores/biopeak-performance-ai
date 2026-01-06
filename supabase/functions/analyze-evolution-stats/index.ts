import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log(`[analyze-evolution-stats] Processing for user: ${userId}`);

    // Fetch evolution stats
    const { data: evolutionStats, error: statsError } = await supabase
      .from('user_evolution_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsError || !evolutionStats) {
      console.error('Stats error:', statsError);
      return new Response(JSON.stringify({ error: 'No evolution stats found. Generate your stats first.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, birth_date, primary_sport, goal_type')
      .eq('id', userId)
      .single();

    // Build context for AI
    const userName = profile?.full_name || 'Atleta';
    const userAge = profile?.birth_date 
      ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;
    const primarySport = profile?.primary_sport || 'corrida';
    const goalType = profile?.goal_type || 'melhorar performance';

    const stats = evolutionStats.stats_data;

    // Format data for the prompt
    const formatFitnessScore = (data: any[]) => {
      if (!data?.length) return 'Sem dados disponíveis';
      return data.map(d => `Semana ${d.week}: ${d.fitnessScore ?? 'N/A'} pontos`).join('\n');
    };

    const formatDistance = (data: any[]) => {
      if (!data?.length) return 'Sem dados disponíveis';
      return data.map(d => `Semana ${d.week}: ${((d.totalDistance || 0) / 1000).toFixed(1)} km (${d.activitiesCount || 0} atividades)`).join('\n');
    };

    const formatPace = (data: any) => {
      if (!data || Object.keys(data).length === 0) return 'Sem dados disponíveis';
      const result: string[] = [];
      for (const [sport, weeks] of Object.entries(data)) {
        if (Array.isArray(weeks) && weeks.length > 0) {
          const sportData = weeks.map((w: any) => `  Semana ${w.week}: ${w.avgPace?.toFixed(2) || 'N/A'} min/km`).join('\n');
          result.push(`${sport}:\n${sportData}`);
        }
      }
      return result.length > 0 ? result.join('\n') : 'Sem dados disponíveis';
    };

    const formatHeartRate = (data: any[]) => {
      if (!data?.length) return 'Sem dados disponíveis';
      return data.map(d => `Semana ${d.week}: Média ${d.avgHeartRate || 'N/A'} bpm, Máx ${d.maxHeartRate || 'N/A'} bpm`).join('\n');
    };

    const formatCalories = (data: any[]) => {
      if (!data?.length) return 'Sem dados disponíveis';
      return data.map(d => `Semana ${d.week}: ${d.totalCalories || 0} kcal`).join('\n');
    };

    const formatDistribution = (data: any[]) => {
      if (!data?.length) return 'Sem dados disponíveis';
      return data.map(d => `${d.activityType}: ${d.count} atividades (${d.percentage?.toFixed(1) || 0}%)`).join('\n');
    };

    const prompt = `Você é um coach esportivo profissional e experiente, especializado em análise de performance para atletas amadores e profissionais. Sua função é analisar os dados de evolução das últimas 8 semanas deste atleta e fornecer uma análise detalhada, personalizada e motivadora.

PERFIL DO ATLETA:
- Nome: ${userName}
${userAge ? `- Idade: ${userAge} anos` : ''}
- Esporte principal: ${primarySport}
- Objetivo: ${goalType}

═══════════════════════════════════════════════════════════════

📊 EVOLUÇÃO DO FITNESS SCORE (últimas 8 semanas):
${formatFitnessScore(stats?.fitnessScoreEvolution)}

📏 EVOLUÇÃO DE DISTÂNCIA SEMANAL:
${formatDistance(stats?.distanceEvolution)}

⏱️ EVOLUÇÃO DE PACE POR MODALIDADE:
${formatPace(stats?.paceEvolution)}

❤️ EVOLUÇÃO DE FREQUÊNCIA CARDÍACA:
${formatHeartRate(stats?.heartRateEvolution)}

🔥 EVOLUÇÃO DE CALORIAS GASTAS:
${formatCalories(stats?.caloriesEvolution)}

📈 DISTRIBUIÇÃO DE ATIVIDADES:
${formatDistribution(stats?.activityDistribution)}

═══════════════════════════════════════════════════════════════

Com base nesses dados, forneça uma análise COMPLETA e ESTRUTURADA incluindo:

## 📋 Resumo Geral
Uma visão geral concisa da performance do atleta nas últimas semanas (2-3 frases impactantes).

## 💪 Pontos Fortes
Liste 3-4 aspectos positivos identificados nos dados, sendo específico com números quando possível.

## 🎯 Áreas de Melhoria
Identifique 3-4 oportunidades de melhoria baseadas nos dados, com sugestões práticas.

## 📈 Tendências Identificadas
Descreva os padrões e tendências observados (progressão, estagnação, variações) com base nos números.

## 🚀 Recomendações Personalizadas
Forneça 4-5 ações específicas e práticas para as próximas semanas, considerando o esporte principal e objetivo do atleta.

## 🔮 Projeção
Baseado nas tendências atuais, o que o atleta pode esperar se mantiver o ritmo? Inclua uma estimativa realista.

DIRETRIZES:
- Use linguagem motivadora mas realista
- Seja específico com os números dos dados
- Evite generalidades - personalize para este atleta
- Mantenha um tom profissional e encorajador
- Responda em português do Brasil
- Use emojis moderadamente para melhor legibilidade`;

    console.log('[analyze-evolution-stats] Calling Lovable AI...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um coach esportivo profissional especializado em análise de performance. Sempre responda em português do Brasil.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Muitas requisições. Tente novamente em alguns minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Entre em contato com o suporte.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content;

    if (!analysis) {
      throw new Error('No analysis generated');
    }

    console.log('[analyze-evolution-stats] Analysis generated successfully');

    return new Response(JSON.stringify({ 
      analysis,
      generatedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-evolution-stats] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro ao gerar análise' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
