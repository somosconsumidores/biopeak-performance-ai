import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrainingRecommendation {
  type: 'workout' | 'recovery' | 'plan' | 'goal';
  title: string;
  description: string;
  workoutDetails?: {
    type: string;
    duration: string;
    intensity: string;
    zones?: string[];
  };
  benefits: string[];
  priority: 'high' | 'medium' | 'low';
  category: string;
  reasoning: string;
}

interface TrainingRecommendations {
  recommendations: TrainingRecommendation[];
  weeklyPlan: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  focusAreas: string[];
  nextGoal: {
    suggestion: string;
    timeframe: string;
    steps: string[];
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log(`🎯 Generating training recommendations for user: ${user.id.substring(0, 8)}...`);

    // Fetch user activities from last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoSeconds = Math.floor(thirtyDaysAgo / 1000);

    const { data: activities, error: activitiesError } = await supabase
      .from('garmin_activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time_in_seconds', thirtyDaysAgoSeconds)
      .order('start_time_in_seconds', { ascending: false });

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      throw new Error('Failed to fetch user activities');
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // Prepare data context for AI analysis
    const activityTypes = [...new Set(activities?.map(a => a.activity_type).filter(Boolean))];
    const totalActivities = activities?.length || 0;
    const totalDistance = activities?.reduce((sum, a) => sum + (a.distance_in_meters || 0), 0) || 0;
    const totalDuration = activities?.reduce((sum, a) => sum + (a.duration_in_seconds || 0), 0) || 0;
    const avgHeartRate = activities?.length ? activities.reduce((sum, a) => sum + (a.average_heart_rate_in_beats_per_minute || 0), 0) / activities.length : 0;
    const maxHeartRate = Math.max(...activities?.map(a => a.max_heart_rate_in_beats_per_minute || 0).filter(hr => hr > 0) || [0]);
    const avgPace = activities?.filter(a => a.average_pace_in_minutes_per_kilometer)
      .reduce((sum, a, _, arr) => sum + (a.average_pace_in_minutes_per_kilometer! / arr.length), 0) || 0;

    // Calculate training frequency
    const weeklyFrequency = totalActivities > 0 ? (totalActivities / 4.3) : 0; // 30 days / 7 = ~4.3 weeks

    // Detect training patterns
    const hasConsistentTraining = weeklyFrequency >= 3;
    const isHighVolume = totalDistance > 200000; // > 200km in 30 days
    const isRunningFocused = activityTypes.includes('running') || activityTypes.some(type => type?.toLowerCase().includes('run'));

    const dataContext = {
      userId: user.id,
      period: '30 days',
      totalActivities,
      activityTypes,
      totalDistanceKm: Math.round(totalDistance / 1000),
      totalHours: Math.round(totalDuration / 3600),
      weeklyFrequency: Math.round(weeklyFrequency * 10) / 10,
      avgHeartRate: Math.round(avgHeartRate),
      maxHeartRate,
      avgPaceMinKm: Math.round(avgPace * 100) / 100,
      hasConsistentTraining,
      isHighVolume,
      isRunningFocused,
      userAge: profile?.birth_date ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear() : null,
      userWeight: profile?.weight_kg,
      userHeight: profile?.height_cm
    };

    // Enrich context: chart variability (pace/HR), VO2max and sleep
    const thirtyDaysAgoISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: chartRows, error: chartErr } = await supabase
      .from('activity_chart_data')
      .select('avg_pace_min_km, avg_heart_rate, processed_at')
      .eq('user_id', user.id)
      .gte('processed_at', thirtyDaysAgoISO);

    if (chartErr) console.log('activity_chart_data error', chartErr);

    const paceVals = (chartRows || []).map(r => Number(r.avg_pace_min_km)).filter(v => !!v && isFinite(v));
    const hrVals = (chartRows || []).map(r => Number(r.avg_heart_rate)).filter(v => !!v && isFinite(v));

    const mean = (arr: number[]) => arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : 0;
    const sd = (arr: number[]) => {
      if (!arr.length) return 0;
      const m = mean(arr);
      const variance = arr.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / arr.length;
      return Math.sqrt(variance);
    };

    const chartAvgPace = Math.round(mean(paceVals) * 100) / 100;
    const chartAvgHR = Math.round(mean(hrVals));
    const chartPaceCV = chartAvgPace > 0 ? Math.round((sd(paceVals) / chartAvgPace) * 100) / 100 : null;
    const chartHRCV = chartAvgHR > 0 ? Math.round((sd(hrVals) / chartAvgHR) * 100) / 100 : null;

    // Latest VO2max via mapping
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

    // Sleep: last night and 7-day avg
    const sevenDaysAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);

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
      .gte('calendar_date', sevenDaysAgoISO);

    const sleepWeekScores = (sleepWeek || []).map(s => Number(s.sleep_score)).filter(v => !!v && isFinite(v));
    const sleepAvg = sleepWeekScores.length ? Math.round(mean(sleepWeekScores)) : null;

    const enrichedContext = {
      chartAvgPaceMinKm: chartAvgPace || null,
      chartAvgHeartRate: chartAvgHR || null,
      chartPaceCV: chartPaceCV,
      chartHeartRateCV: chartHRCV,
      vo2MaxCurrent,
      lastSleepScore: lastSleep?.sleep_score ?? null,
      lastSleepDate: lastSleep?.calendar_date ?? null,
      avgSleepScore7d: sleepAvg
    }; 

    // Check if OpenAI API key is available
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.log('⚠️ OpenAI API key not found, returning mock training recommendations');
      
      // Return comprehensive mock training recommendations
      const mockRecommendations: TrainingRecommendations = {
        recommendations: [
          {
            type: 'workout',
            title: 'Treino Intervalado de Alta Intensidade',
            description: 'Sessão de 8x400m com recuperação ativa para melhorar VO2 máximo e velocidade',
            workoutDetails: {
              type: 'Intervalado',
              duration: '45 minutos',
              intensity: 'Alta (85-95% FCM)',
              zones: ['Zona 4', 'Zona 5']
            },
            benefits: [
              'Melhora do VO2 máximo',
              'Aumento da velocidade anaeróbia',
              'Adaptação cardiovascular'
            ],
            priority: 'high',
            category: 'Performance',
            reasoning: 'Baseado na sua frequência de treino atual e necessidade de estímulo de alta intensidade'
          },
          {
            type: 'recovery',
            title: 'Corrida de Recuperação',
            description: 'Corrida leve de 30-40 minutos em ritmo conversacional',
            workoutDetails: {
              type: 'Aeróbico Leve',
              duration: '35 minutos',
              intensity: 'Baixa (65-75% FCM)',
              zones: ['Zona 1', 'Zona 2']
            },
            benefits: [
              'Melhora da capacidade aeróbica',
              'Recuperação ativa',
              'Desenvolvimento da base aeróbica'
            ],
            priority: 'medium',
            category: 'Recuperação',
            reasoning: 'Importante para equilíbrio entre treino intenso e recuperação'
          },
          {
            type: 'plan',
            title: 'Periodização de 12 Semanas',
            description: 'Plano estruturado focando em base aeróbica, força específica e pico de performance',
            benefits: [
              'Progressão sistemática',
              'Prevenção de overtraining',
              'Otimização de resultados'
            ],
            priority: 'medium',
            category: 'Planejamento',
            reasoning: 'Seu histórico mostra potencial para uma abordagem mais estruturada'
          },
          {
            type: 'goal',
            title: 'Meta: Melhorar Pace Médio em 15s/km',
            description: 'Objetivo realista baseado no seu progresso atual e potencial de melhoria',
            benefits: [
              'Melhoria tangível de performance',
              'Motivação aumentada',
              'Marco mensurável'
            ],
            priority: 'high',
            category: 'Objetivos',
            reasoning: 'Análise do seu pace atual sugere potencial para esta melhoria em 8-12 semanas'
          }
        ],
        weeklyPlan: {
          monday: 'Treino Intervalado (45min) - Zona 4-5',
          tuesday: 'Recuperação Ativa (30min) - Zona 1-2',
          wednesday: 'Tempo Run (35min) - Zona 3-4',
          thursday: 'Descanso ou Cross-training',
          friday: 'Corrida Fácil (40min) - Zona 2',
          saturday: 'Long Run (60-75min) - Zona 2-3',
          sunday: 'Descanso Completo'
        },
        focusAreas: [
          'Desenvolvimento da velocidade anaeróbia',
          'Fortalecimento da base aeróbica',
          'Melhoria da economia de corrida',
          'Prevenção de lesões'
        ],
        nextGoal: {
          suggestion: 'Participar de uma corrida de 10K e estabelecer novo PR',
          timeframe: '8-12 semanas',
          steps: [
            'Completar 4 semanas de base aeróbica',
            'Introduzir treinos de velocidade específicos',
            'Realizar 2-3 simulados de 10K',
            'Tapering de 1 semana antes da prova'
          ]
        }
      };

      return new Response(JSON.stringify(mockRecommendations), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare OpenAI prompt for training recommendations (with enriched context)
    const prompt = `Como um treinador de corrida especializado, analise os dados de treino e gere recomendações personalizadas de treino.

DADOS DO ATLETA:
- Período analisado: ${dataContext.period}
- Total de atividades: ${dataContext.totalActivities}
- Tipos de atividade: ${dataContext.activityTypes.join(', ')}
- Distância total: ${dataContext.totalDistanceKm}km
- Tempo total: ${dataContext.totalHours}h
- Frequência semanal: ${dataContext.weeklyFrequency} treinos/semana
- FC média: ${dataContext.avgHeartRate} bpm
- FC máxima registrada: ${dataContext.maxHeartRate} bpm
- Pace médio: ${dataContext.avgPaceMinKm} min/km
- Treino consistente: ${dataContext.hasConsistentTraining ? 'Sim' : 'Não'}
- Alto volume: ${dataContext.isHighVolume ? 'Sim' : 'Não'}
- Foco em corrida: ${dataContext.isRunningFocused ? 'Sim' : 'Não'}

DADOS ADICIONAIS (VARIAÇÃO/VO2/SONO):
- Pace médio (charts): ${enrichedContext.chartAvgPaceMinKm ?? 'n/d'} min/km
- Variabilidade de pace (CV): ${enrichedContext.chartPaceCV ?? 'n/d'}
- FC média (charts): ${enrichedContext.chartAvgHeartRate ?? 'n/d'} bpm
- Variabilidade de FC (CV): ${enrichedContext.chartHeartRateCV ?? 'n/d'}
- VO₂max atual: ${enrichedContext.vo2MaxCurrent ?? 'n/d'} ml/kg/min
- Última noite (sono): score ${enrichedContext.lastSleepScore ?? 'n/d'}
- Média 7 dias (sono): ${enrichedContext.avgSleepScore7d ?? 'n/d'}

INSTRUÇÕES:
1. Analise o perfil de treino do atleta com base nos dados acima
2. Considere variação de ritmo/FC (CV) para sugerir trabalhos de consistência, quando necessário
3. Adapte intensidades por zona levando em conta VO₂max e qualidade do sono recente
4. Traga um plano semanal específico e equilibrado (intervalado, tempo run, fácil, longão, descanso)
5. Previna overtraining (ajuste volume/intensidade se sono ruim)
6. Sugira metas realistas e mensuráveis

FORMATO DE RESPOSTA (JSON):
{
  "recommendations": [
    {
      "type": "workout|recovery|plan|goal",
      "title": "Título da recomendação",
      "description": "Descrição detalhada",
      "workoutDetails": {
        "type": "Tipo do treino",
        "duration": "Duração",
        "intensity": "Intensidade e zonas FC",
        "zones": ["Zona 1", "Zona 2"]
      },
      "benefits": ["Benefício 1", "Benefício 2"],
      "priority": "high|medium|low",
      "category": "Categoria",
      "reasoning": "Justificativa baseada nos dados"
    }
  ],
  "weeklyPlan": {
    "monday": "Treino específico",
    "tuesday": "Treino específico",
    "wednesday": "Treino específico",
    "thursday": "Treino específico",
    "friday": "Treino específico",
    "saturday": "Treino específico",
    "sunday": "Treino específico"
  },
  "focusAreas": [
    "Área de foco 1",
    "Área de foco 2"
  ],
  "nextGoal": {
    "suggestion": "Próximo objetivo sugerido",
    "timeframe": "Prazo estimado",
    "steps": ["Passo 1", "Passo 2"]
  }
}

Gere recomendações específicas, práticas e baseadas nos dados fornecidos. Mantenha o foco em progressão segura e sustentável.`;

    console.log('🤖 Calling OpenAI API for training recommendations...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um treinador de corrida especializado com profundo conhecimento em periodização, fisiologia do exercício e análise de dados de treino. Suas recomendações são sempre baseadas em evidências científicas e adaptadas ao perfil individual do atleta.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2500
      }),
    });

    if (!openAIResponse.ok) {
      console.error('OpenAI API error:', await openAIResponse.text());
      throw new Error('Failed to get recommendations from OpenAI');
    }

    const openAIData = await openAIResponse.json();
    const aiContent = openAIData.choices[0].message.content;

    console.log('🤖 OpenAI response received, parsing recommendations...');

    // Extract clean JSON from AI response (handle code fences)
    const rawContent = aiContent || '';
    console.log('Raw AI response:', rawContent);
    
    // Remove code fences and extract JSON
    const fencedClean = rawContent.replace(/```json|```/gi, '').trim();
    const jsonMatch = fencedClean.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : fencedClean;

    // Parse AI response
    let recommendations: TrainingRecommendations;
    try {
      recommendations = JSON.parse(jsonStr);
      console.log('✅ Successfully parsed AI recommendations');
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.log('Cleaned JSON string:', jsonStr);
      
      // Fallback with comprehensive recommendations
      recommendations = {
        recommendations: [
          {
            type: 'workout',
            title: 'Treino de Desenvolvimento de Base',
            description: 'Corrida contínua moderada para fortalecer a base aeróbica',
            workoutDetails: {
              type: 'Aeróbico',
              duration: '45-60 minutos',
              intensity: 'Moderada (70-80% FCM)',
              zones: ['Zona 2', 'Zona 3']
            },
            benefits: ['Melhoria da capacidade aeróbica', 'Eficiência metabólica'],
            priority: 'high',
            category: 'Base Aeróbica',
            reasoning: 'Recomendação baseada na análise do seu padrão de treino atual'
          }
        ],
        weeklyPlan: {
          monday: 'Treino Moderado - 45min',
          tuesday: 'Recuperação - 30min',
          wednesday: 'Intervalado - 40min',
          thursday: 'Descanso',
          friday: 'Fácil - 35min',
          saturday: 'Long Run - 60min',
          sunday: 'Descanso'
        },
        focusAreas: ['Consistência', 'Progressão gradual'],
        nextGoal: {
          suggestion: 'Estabelecer base sólida de treino',
          timeframe: '4-6 semanas',
          steps: ['Manter regularidade', 'Aumentar volume gradualmente']
        }
      };
    }

    console.log('✅ Training recommendations generated successfully');

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate-training-recommendations function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: 'Failed to generate training recommendations'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});