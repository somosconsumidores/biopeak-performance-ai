import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActivityComparison {
  currentActivity: {
    id: string;
    type: string;
    classifiedType: string;
    duration: number | null;
    distance: number | null;
    pace: number | null;
    avgHeartRate: number | null;
    calories: number | null;
    elevation: number | null;
    date: string;
  };
  historicalStats: {
    totalActivities: number;
    avgDuration: number | null;
    avgDistance: number | null;
    avgPace: number | null;
    avgHeartRate: number | null;
    dateRange: string;
  };
  comparisons: {
    duration: {
      current: number | null;
      historical: number | null;
      difference: number | null;
      percentChange: number | null;
      isImprovement: boolean | null;
    };
    distance: {
      current: number | null;
      historical: number | null;
      difference: number | null;
      percentChange: number | null;
      isImprovement: boolean | null;
    };
    pace: {
      current: number | null;
      historical: number | null;
      difference: number | null;
      percentChange: number | null;
      isImprovement: boolean | null;
    };
    heartRate: {
      current: number | null;
      historical: number | null;
      difference: number | null;
      percentChange: number | null;
      isImprovement: boolean | null;
    };
  };
  aiRecommendations: {
    performanceAnalysis: string[];
    strengths: string[];
    areasToImprove: string[];
    recommendations: string[];
    recoveryGuidance: string;
    nextWorkoutSuggestions: string;
  };
}

// Helper para formatar pace em min:seg/km
const formatPace = (paceMinKm: number | null): string => {
  if (!paceMinKm) return 'N/A';
  const minutes = Math.floor(paceMinKm);
  const seconds = Math.round((paceMinKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
};

// Helper para converter pace para velocidade (km/h)
const paceToSpeed = (paceMinKm: number | null): number | null => {
  if (!paceMinKm || paceMinKm <= 0) return null;
  return 60 / paceMinKm;
};

// Helper para formatar velocidade em km/h
const formatSpeed = (paceMinKm: number | null): string => {
  const speedKmh = paceToSpeed(paceMinKm);
  if (!speedKmh) return 'N/A';
  return `${speedKmh.toFixed(1)} km/h`;
};

// Helper para formatar pace ou velocidade baseado no tipo de atividade
const formatPaceOrSpeed = (paceMinKm: number | null, isCycling: boolean): string => {
  return isCycling ? formatSpeed(paceMinKm) : formatPace(paceMinKm);
};

// Helper para obter label de pace/velocidade
const getPaceOrSpeedLabel = (isCycling: boolean): string => {
  return isCycling ? 'Velocidade' : 'Pace';
};

// Classificação de tipos de atividade
const classifyActivityType = (activityType: string | null): string => {
  if (!activityType) return 'Unknown';
  
  const type = activityType.toUpperCase();
  
  // WeightTraining
  if (['WEIGHTTRAINING', 'WORKOUT', 'STRENGTH_TRAINING'].includes(type)) {
    return 'WeightTraining';
  }
  
  // Walking
  if (['WALK', 'WALKING'].includes(type)) {
    return 'Walking';
  }
  
  // Swimming
  if (['SWIM', 'LAP_SWIMMING', 'OPEN_WATER_SWIMMING'].includes(type)) {
    return 'Swimming';
  }
  
  // Running
  if (['RUN', 'RUNNING', 'TREADMILL_RUNNING', 'INDOOR_CARDIO'].includes(type)) {
    return 'Running';
  }
  
  // Cycling
  if (['RIDE', 'CYCLING', 'ROAD_BIKING', 'VIRTUALRIDE', 'MOUNTAIN_BIKING', 'INDOOR_CYCLING'].includes(type)) {
    return 'Cycling';
  }
  
  return 'Other';
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get activityId from request body
    const body = await req.json();
    const { activityId } = body;
    
    if (!activityId) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔍 Starting workout comparison analysis for activity:', activityId);

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Create clients
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user info
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Invalid authorization');
    }

    // 1. Buscar atividade atual na tabela all_activities
    const { data: currentActivity, error: activityError } = await serviceSupabase
      .from('all_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
      .single();

    if (activityError || !currentActivity) {
      throw new Error('Activity not found in unified activities table');
    }

    console.log('✅ Found current activity:', currentActivity.activity_type);

    // 2. Classificar tipo de atividade
    const classifiedType = classifyActivityType(currentActivity.activity_type);
    console.log('🏷️ Classified activity type:', classifiedType);

    // 3. Buscar atividades históricas do mesmo tipo (últimos 30 dias, excluindo a atual)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Buscar todos os tipos que se enquadram na mesma classificação
    const getActivityTypesForClassification = (classification: string): string[] => {
      switch (classification) {
        case 'WeightTraining':
          return ['WeightTraining', 'Workout', 'STRENGTH_TRAINING'];
        case 'Walking':
          return ['Walk', 'WALKING'];
        case 'Swimming':
          return ['Swim', 'LAP_SWIMMING', 'OPEN_WATER_SWIMMING'];
        case 'Running':
          return ['Run', 'RUNNING', 'TREADMILL_RUNNING', 'INDOOR_CARDIO'];
        case 'Cycling':
          return ['Ride', 'CYCLING', 'ROAD_BIKING', 'VirtualRide', 'MOUNTAIN_BIKING', 'INDOOR_CYCLING'];
        default:
          return [currentActivity.activity_type || ''];
      }
    };

    const targetActivityTypes = getActivityTypesForClassification(classifiedType);
    console.log('🎯 Looking for historical activities of types:', targetActivityTypes);

    const { data: historicalActivities, error: historyError } = await serviceSupabase
      .from('all_activities')
      .select('*')
      .eq('user_id', user.id)
      .in('activity_type', targetActivityTypes)
      .gte('activity_date', thirtyDaysAgo.toISOString().split('T')[0])
      .neq('activity_id', activityId) // Excluir a atividade atual
      .order('activity_date', { ascending: false });

    if (historyError) {
      console.error('Error fetching historical activities:', historyError);
    }

    const validHistoricalActivities = historicalActivities || [];
    console.log(`📊 Found ${validHistoricalActivities.length} historical activities of same type`);

    // 4. Calcular estatísticas históricas
    const calculateStats = (activities: any[]) => {
      if (activities.length === 0) return null;
      
      const validDurations = activities.filter(a => a.total_time_minutes).map(a => a.total_time_minutes);
      const validDistances = activities.filter(a => a.total_distance_meters).map(a => a.total_distance_meters);
      const validHeartRates = activities.filter(a => a.average_heart_rate).map(a => a.average_heart_rate);
      
      // Para pace médio: somar todos os tempos e dividir pela soma de todas as distâncias
      const activitiesWithTimeAndDistance = activities.filter(a => a.total_time_minutes && a.total_distance_meters && a.total_distance_meters > 0);
      let avgPace = null;
      
      if (activitiesWithTimeAndDistance.length > 0) {
        const totalTimeMinutes = activitiesWithTimeAndDistance.reduce((sum, a) => sum + a.total_time_minutes, 0);
        const totalDistanceMeters = activitiesWithTimeAndDistance.reduce((sum, a) => sum + a.total_distance_meters, 0);
        avgPace = totalTimeMinutes / (totalDistanceMeters / 1000); // min/km
      }
      
      return {
        totalActivities: activities.length,
        avgDuration: validDurations.length ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length : null,
        avgDistance: validDistances.length ? validDistances.reduce((a, b) => a + b, 0) / validDistances.length : null,
        avgPace: avgPace,
        avgHeartRate: validHeartRates.length ? validHeartRates.reduce((a, b) => a + b, 0) / validHeartRates.length : null,
      };
    };

    const historicalStats = calculateStats(validHistoricalActivities);

    // 5. Buscar dados granulares da activity_chart_data
    const { data: chartData } = await serviceSupabase
      .from('activity_chart_data')
      .select('series_data, avg_heart_rate, avg_pace_min_km, data_points_count')
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
      .maybeSingle();

    console.log('📈 Chart data available:', !!chartData);

    // 6. Calcular comparações
    const calculateComparison = (current: number | null, historical: number | null, lowerIsBetter = false) => {
      if (current === null || historical === null) {
        return {
          current,
          historical,
          difference: null,
          percentChange: null,
          isImprovement: null,
        };
      }
      
      const difference = current - historical;
      const percentChange = (difference / historical) * 100;
      const isImprovement = lowerIsBetter ? difference < 0 : difference > 0;
      
      return {
        current,
        historical,
        difference,
        percentChange,
        isImprovement,
      };
    };

    const comparisons = {
      duration: calculateComparison(currentActivity.total_time_minutes, historicalStats?.avgDuration),
      distance: calculateComparison(currentActivity.total_distance_meters, historicalStats?.avgDistance),
      pace: calculateComparison(currentActivity.pace_min_per_km, historicalStats?.avgPace, true), // Lower pace is better
      heartRate: calculateComparison(currentActivity.average_heart_rate, historicalStats?.avgHeartRate),
    };

    // 7. Preparar dados para IA
    const activityForAI = {
      current: {
        type: classifiedType,
        duration_minutes: currentActivity.total_time_minutes,
        distance_meters: currentActivity.total_distance_meters,
        pace_min_km: currentActivity.pace_min_per_km,
        avg_heart_rate: currentActivity.average_heart_rate,
        calories: currentActivity.active_kilocalories,
        elevation_gain: currentActivity.total_elevation_gain_in_meters,
        date: currentActivity.activity_date,
      },
      historical: historicalStats,
      comparisons,
      granularData: chartData ? {
        totalPoints: chartData.data_points_count,
        avgHeartRateDetailed: chartData.avg_heart_rate,
        avgPaceDetailed: chartData.avg_pace_min_km,
        hasSamples: Array.isArray(chartData.series_data) && chartData.series_data.length > 0
      } : null
    };

    // Determinar se é ciclismo para usar velocidade ao invés de pace
    const isCycling = classifiedType === 'Cycling';
    const paceSpeedLabel = getPaceOrSpeedLabel(isCycling);
    const currentPaceOrSpeed = formatPaceOrSpeed(currentActivity.pace_min_per_km, isCycling);
    const historicalPaceOrSpeed = historicalStats ? formatPaceOrSpeed(historicalStats.avgPace, isCycling) : 'N/A';

    // 8. Chamar OpenAI para análise inteligente
    const aiPrompt = `
Analise este treino de ${classifiedType} e forneça recomendações inteligentes e personalizadas:

ATIVIDADE ATUAL:
- Tipo: ${classifiedType}
- Duração: ${currentActivity.total_time_minutes?.toFixed(1) || 'N/A'} min
- Distância: ${currentActivity.total_distance_meters ? (currentActivity.total_distance_meters / 1000).toFixed(1) : 'N/A'} km
- ${paceSpeedLabel}: ${currentPaceOrSpeed}
- FC Média: ${currentActivity.average_heart_rate || 'N/A'} bpm
- Calorias: ${currentActivity.active_kilocalories || 'N/A'}
- Ganho de elevação: ${currentActivity.total_elevation_gain_in_meters || 'N/A'} m

COMPARAÇÃO COM HISTÓRICO (últimos 30 dias):
${historicalStats ? `
- Total de treinos similares: ${historicalStats.totalActivities}
- Duração média histórica: ${historicalStats.avgDuration?.toFixed(1) || 'N/A'} min (atual: ${comparisons.duration.percentChange?.toFixed(1) || 'N/A'}% ${comparisons.duration.isImprovement ? 'melhor' : 'pior'})
- Distância média histórica: ${historicalStats.avgDistance ? (historicalStats.avgDistance / 1000).toFixed(1) : 'N/A'} km (atual: ${comparisons.distance.percentChange?.toFixed(1) || 'N/A'}% ${comparisons.distance.isImprovement ? 'maior' : 'menor'})
- ${paceSpeedLabel} médio histórico: ${historicalPaceOrSpeed} (atual: ${comparisons.pace.percentChange?.toFixed(1) || 'N/A'}% ${comparisons.pace.isImprovement ? 'mais rápido' : 'mais lento'})
- FC média histórica: ${historicalStats.avgHeartRate?.toFixed(0) || 'N/A'} bpm (atual: ${comparisons.heartRate.percentChange?.toFixed(1) || 'N/A'}% ${comparisons.heartRate.isImprovement ? 'maior' : 'menor'})
` : 'Sem dados históricos suficientes para comparação.'}

${chartData ? `
DADOS GRANULARES DISPONÍVEIS:
- ${chartData.data_points_count} pontos de dados coletados
- Dados detalhados de FC e ${isCycling ? 'velocidade' : 'pace'} disponíveis
` : ''}

Por favor, forneça uma análise estruturada em JSON com o seguinte formato:
{
  "performanceAnalysis": [
    "Array de 2-3 observações sobre a performance atual vs histórico"
  ],
  "strengths": [
    "Array de 2-3 pontos fortes identificados neste treino"
  ],
  "areasToImprove": [
    "Array de 2-3 áreas que podem ser melhoradas"
  ],
  "recommendations": [
    "Array de 3-4 recomendações específicas e acionáveis para próximos treinos"
  ],
  "recoveryGuidance": "Uma frase sobre tempo de recovery recomendado",
  "nextWorkoutSuggestions": "Uma frase sugerindo o próximo tipo de treino"
}

IMPORTANTE: ${isCycling ? 'Esta é uma atividade de CICLISMO. Use sempre "velocidade" (km/h) nas análises e recomendações, NUNCA use "pace" ou "ritmo" em min/km.' : 'Use "pace" ou "ritmo" (min/km) nas análises e recomendações.'}

Seja específico para o tipo de atividade (${classifiedType}), use os dados de comparação para dar insights valiosos, e mantenha as recomendações práticas e acionáveis. Se não houver dados históricos, foque na análise absoluta da performance atual.
`;

    console.log('🤖 Sending prompt to OpenAI...');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um coach esportivo especializado em análise de performance. Responda sempre em português brasileiro e seja específico nas recomendações.' 
          },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let aiRecommendations;

    try {
      const aiContent = aiData.choices[0].message.content;
      // Try to parse as JSON, fall back to structured text if needed
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiRecommendations = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback structure if JSON parsing fails
        aiRecommendations = {
          performanceAnalysis: ["Análise de performance baseada nos dados disponíveis."],
          strengths: ["Pontos fortes identificados neste treino."],
          areasToImprove: ["Áreas para melhoria identificadas."],
          recommendations: ["Continue treinando consistentemente.", "Monitore sua progressão.", "Mantenha uma boa hidratação."],
          recoveryGuidance: "Descanse adequadamente antes do próximo treino.",
          nextWorkoutSuggestions: "Considere um treino complementar na próxima sessão."
        };
      }
    } catch (error) {
      console.error('Error parsing AI response:', error);
      // Fallback recommendations
      aiRecommendations = {
        performanceAnalysis: ["Análise de performance baseada nos dados disponíveis."],
        strengths: ["Treino concluído com sucesso."],
        areasToImprove: ["Continue focando na consistência."],
        recommendations: ["Mantenha a regularidade nos treinos.", "Monitore sua progressão.", "Ajuste a intensidade conforme necessário."],
        recoveryGuidance: "Permita recuperação adequada entre os treinos.",
        nextWorkoutSuggestions: "Planeje o próximo treino baseado em seus objetivos."
      };
    }

    console.log('✅ AI analysis completed');

    // 9. Preparar resposta final
    const comparison: ActivityComparison = {
      currentActivity: {
        id: currentActivity.activity_id,
        type: currentActivity.activity_type || 'Unknown',
        classifiedType,
        duration: currentActivity.total_time_minutes,
        distance: currentActivity.total_distance_meters,
        pace: currentActivity.pace_min_per_km,
        avgHeartRate: currentActivity.average_heart_rate,
        calories: currentActivity.active_kilocalories,
        elevation: currentActivity.total_elevation_gain_in_meters,
        date: currentActivity.activity_date,
      },
      historicalStats: {
        totalActivities: historicalStats?.totalActivities || 0,
        avgDuration: historicalStats?.avgDuration || null,
        avgDistance: historicalStats?.avgDistance || null,
        avgPace: historicalStats?.avgPace || null,
        avgHeartRate: historicalStats?.avgHeartRate || null,
        dateRange: `Últimos 30 dias`,
      },
      comparisons,
      aiRecommendations,
    };

    console.log('🎉 Workout comparison analysis completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      comparison 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in analyze-workout-comparison:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to analyze workout comparison' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});