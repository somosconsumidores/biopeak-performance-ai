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

    // Format data for the prompt - using correct field names from stats_data
    const formatFitnessScore = (data: any[]) => {
      if (!data?.length) return 'Sem dados';
      return data.map(d => `${d.week}: ${d.fitnessScore ?? '-'}`).join(' | ');
    };

    const formatDistance = (data: any[]) => {
      if (!data?.length) return 'Sem dados';
      return data.map(d => `${d.week}: ${d.totalKm?.toFixed(1) ?? '0'} km`).join(' | ');
    };

    // Helper to format pace as min:sec/km (e.g., 5.5 → "5:30/km")
    const formatPaceMinSec = (paceDecimal: number): string => {
      const minutes = Math.floor(paceDecimal);
      const seconds = Math.round((paceDecimal - minutes) * 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
    };

    // Format all available pace data by sport
    const formatAllPaces = (data: any) => {
      if (!data) return 'Sem dados';
      const results: string[] = [];

      // Running - format as min:sec/km
      const runningData = data['running'] || data['corrida'] || [];
      if (Array.isArray(runningData) && runningData.some((w: any) => w.avgPace != null)) {
        const runPaces = runningData
          .filter((w: any) => w.avgPace != null)
          .map((w: any) => `${w.week}: ${formatPaceMinSec(w.avgPace)}`)
          .join(' | ');
        results.push(`Corrida: ${runPaces}`);
      }

      // Cycling - format as km/h
      const cyclingData = data['cycling'] || data['ciclismo'] || [];
      if (Array.isArray(cyclingData) && cyclingData.some((w: any) => w.avgPace != null)) {
        const cyclePaces = cyclingData
          .filter((w: any) => w.avgPace != null)
          .map((w: any) => `${w.week}: ${w.avgPace.toFixed(1)} km/h`)
          .join(' | ');
        results.push(`Ciclismo: ${cyclePaces}`);
      }

      // Walking
      const walkingData = data['walking'] || data['caminhada'] || [];
      if (Array.isArray(walkingData) && walkingData.some((w: any) => w.avgPace != null)) {
        const walkPaces = walkingData
          .filter((w: any) => w.avgPace != null)
          .map((w: any) => `${w.week}: ${formatPaceMinSec(w.avgPace)}`)
          .join(' | ');
        results.push(`Caminhada: ${walkPaces}`);
      }

      return results.length > 0 ? results.join('\n• ') : 'Sem dados';
    };

    const formatHeartRate = (data: any[]) => {
      if (!data?.length) return 'Sem dados';
      return data.map(d => `${d.week}: ${d.avgHeartRate ?? '-'}/${d.maxHeartRate ?? '-'} bpm`).join(' | ');
    };

    const formatCalories = (data: any[]) => {
      if (!data?.length) return 'Sem dados';
      return data.map(d => `${d.week}: ${d.totalCalories ?? 0} kcal`).join(' | ');
    };

    const formatDistribution = (data: any[]) => {
      if (!data?.length) return 'Sem dados';
      return data.map(d => `${d.activityType}: ${d.count} (${d.percentage?.toFixed(0)}%)`).join(', ');
    };

    const prompt = `Você é um coach esportivo. Analise os dados de evolução deste atleta e forneça uma análise CONCISA e OBJETIVA.

ATLETA: ${userName}${userAge ? `, ${userAge} anos` : ''}, foco em ${primarySport}
OBJETIVO: ${goalType}

DADOS DAS ÚLTIMAS 8 SEMANAS:
• Fitness Score: ${formatFitnessScore(stats?.fitnessScoreEvolution)}
• Km/semana: ${formatDistance(stats?.distanceEvolution)}
• Pace por esporte:
  ${formatAllPaces(stats?.paceEvolution)}
• FC média/máx: ${formatHeartRate(stats?.heartRateEvolution)}
• Calorias: ${formatCalories(stats?.caloriesEvolution)}
• Distribuição: ${formatDistribution(stats?.activityDistribution)}

⚠️ REGRAS OBRIGATÓRIAS:
- NÃO sugira comprar equipamentos (monitor de FC, relógio, etc) - os dados JÁ estão sendo coletados automaticamente
- NÃO comente sobre forma de registro das atividades - isso é responsabilidade do aplicativo
- NÃO mencione "ausência de dados" quando os números existem acima
- NÃO dê dicas sobre como sincronizar ou registrar treinos
- Foque APENAS em análise de performance baseada nos números reais apresentados

FORMATO DA RESPOSTA (máximo 300 palavras):

**Resumo**: 2-3 frases diretas sobre a performance geral, citando números específicos.

**Pontos fortes**: 2-3 bullet points específicos baseados nos dados.

**Oportunidades**: 2-3 bullet points de melhoria prática de treino.

**Próximas semanas**: UMA recomendação principal, objetiva e acionável.

Responda em português brasileiro. Tom motivador mas direto, sem rodeios.`;

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
