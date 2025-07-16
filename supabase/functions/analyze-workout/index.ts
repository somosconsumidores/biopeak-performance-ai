import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkoutAnalysis {
  whatWorked: string[];
  toImprove: string[];
  recommendations: string[];
  performanceInsights: {
    efficiency: string;
    pacing: string;
    heartRateAnalysis: string;
    effortDistribution: string;
  };
  recoveryGuidance: {
    estimatedRecoveryTime: string;
    nextWorkoutSuggestions: string;
    nutritionTips: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('Authorization required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid authorization');
    }

    const { activityId } = await req.json();
    
    if (!activityId) {
      throw new Error('Activity ID is required');
    }

    console.log('🤖 AI Analysis: Starting analysis for activity:', activityId, 'User:', user.id);

    // Get workout summary data
    const { data: activity, error: activityError } = await supabase
      .from('garmin_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
      .single();

    if (activityError || !activity) {
      throw new Error('Activity not found');
    }

    // Get detailed workout data
    const { data: activityDetails, error: detailsError } = await supabase
      .from('garmin_activity_details')
      .select('heart_rate, speed_meters_per_second, elevation_in_meters, power_in_watts, sample_timestamp')
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
      .order('sample_timestamp', { ascending: true })
      .limit(500); // Limit for performance

    if (detailsError) {
      console.error('Error fetching activity details:', detailsError);
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('birth_date, weight_kg, height_cm')
      .eq('user_id', user.id)
      .single();

    // Calculate user age if birth date is available
    let userAge = null;
    if (profile?.birth_date) {
      const birthDate = new Date(profile.birth_date);
      const today = new Date();
      userAge = today.getFullYear() - birthDate.getFullYear();
    }

    // Calculate pace using multiple methods for accuracy
    let calculatedPaceFromSpeed = null;
    let calculatedPaceFromDistance = null;
    let storedPace = activity.average_pace_in_minutes_per_kilometer;
    
    // Method 1: Calculate from average speed (less reliable for GPS data)
    if (activity.average_speed_in_meters_per_second) {
      calculatedPaceFromSpeed = 60 / (activity.average_speed_in_meters_per_second * 3.6);
    }
    
    // Method 2: Calculate from total distance and time (most accurate)
    // Using formula: Pace = Tempo (em minutos) / Distância (em km)
    if (activity.distance_in_meters && activity.duration_in_seconds) {
      const timeInMinutes = activity.duration_in_seconds / 60;
      const distanceInKm = activity.distance_in_meters / 1000;
      calculatedPaceFromDistance = timeInMinutes / distanceInKm;
      
      console.log(`🔍 Pace calculation details:`);
      console.log(`  Time: ${activity.duration_in_seconds}s = ${timeInMinutes.toFixed(3)} minutes`);
      console.log(`  Distance: ${activity.distance_in_meters}m = ${distanceInKm.toFixed(5)} km`);
      console.log(`  Pace = ${timeInMinutes.toFixed(3)} / ${distanceInKm.toFixed(5)} = ${calculatedPaceFromDistance.toFixed(4)} min/km`);
    }
    
    // Log all calculations for debugging
    console.log(`🔍 Pace Debug for activity ${activityId}:`);
    console.log(`  Distance: ${activity.distance_in_meters}m`);
    console.log(`  Duration: ${activity.duration_in_seconds}s`);
    console.log(`  Average Speed: ${activity.average_speed_in_meters_per_second}m/s`);
    console.log(`  Stored pace: ${storedPace?.toFixed(2)} min/km`);
    console.log(`  Pace from speed: ${calculatedPaceFromSpeed?.toFixed(2)} min/km`);
    console.log(`  Pace from distance/time: ${calculatedPaceFromDistance?.toFixed(2)} min/km`);
    
    // Use the most accurate method (distance/time is generally more reliable)
    const accuratePace = calculatedPaceFromDistance || calculatedPaceFromSpeed || storedPace;
    
    // Convert pace to min:sec format for clarity
    const formatPace = (paceMinKm: number) => {
      const minutes = Math.floor(paceMinKm);
      const seconds = Math.round((paceMinKm - minutes) * 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    const formattedPace = accuratePace ? formatPace(accuratePace) : 'N/A';

    // Calculate pace variations from detailed data for more insights
    let paceAnalysis = '';
    if (activityDetails && activityDetails.length > 0) {
      const speedSamples = activityDetails
        .filter(d => d.speed_meters_per_second && d.speed_meters_per_second > 0)
        .map(d => 60 / (d.speed_meters_per_second * 3.6));
      
      if (speedSamples.length > 0) {
        const minPace = Math.min(...speedSamples);
        const maxPace = Math.max(...speedSamples);
        paceAnalysis = `\n      - Variação de pace: ${minPace.toFixed(2)} - ${maxPace.toFixed(2)} min/km`;
      }
    }

    // Prepare analysis data
    const analysisData = {
      activity: {
        type: activity.activity_type,
        duration: activity.duration_in_seconds,
        distance: activity.distance_in_meters,
        averageHeartRate: activity.average_heart_rate_in_beats_per_minute,
        maxHeartRate: activity.max_heart_rate_in_beats_per_minute,
        averagePace: accuratePace, // Use calculated pace
        storedPace: storedPace, // Include for comparison
        calculatedPaceFromSpeed: calculatedPaceFromSpeed, // Include for debugging
        calculatedPaceFromDistance: calculatedPaceFromDistance, // Include for debugging
        calories: activity.active_kilocalories,
        elevation: activity.total_elevation_gain_in_meters,
        averageSpeed: activity.average_speed_in_meters_per_second,
      },
      userContext: {
        age: userAge,
        weight: profile?.weight_kg,
        height: profile?.height_cm,
      },
      detailedData: activityDetails || [],
    };

    // Create specialized prompts based on activity type
    const basePrompt = `
      Analise os dados do treino de ${activity.activity_type || 'exercício'} e forneça insights detalhados em português brasileiro.
      
      Dados do treino:
      - Tipo: ${activity.activity_type}
      - Duração: ${Math.round((activity.duration_in_seconds || 0) / 60)} minutos
      - Distância: ${((activity.distance_in_meters || 0) / 1000).toFixed(1)} km
       - FC média: ${activity.average_heart_rate_in_beats_per_minute || 'N/A'} bpm
       - FC máxima: ${activity.max_heart_rate_in_beats_per_minute || 'N/A'} bpm
       - Pace médio: ${formattedPace} min/km (${calculatedPaceFromDistance?.toFixed(3) || 'N/A'} min/km decimal)
       ${calculatedPaceFromSpeed ? `- Pace da velocidade: ${formatPace(calculatedPaceFromSpeed)} min/km` : ''}
       ${storedPace ? `- Pace armazenado: ${formatPace(storedPace)} min/km` : ''}${paceAnalysis}
      - Calorias: ${activity.active_kilocalories || 'N/A'} kcal
      - Elevação: ${activity.total_elevation_gain_in_meters || 0}m
      
      ${userAge ? `Idade do usuário: ${userAge} anos` : ''}
      ${profile?.weight_kg ? `Peso: ${profile.weight_kg}kg` : ''}
      
      Forneça uma análise estruturada em JSON com exactly este formato:
      {
        "whatWorked": ["máximo 3 pontos específicos sobre o que funcionou bem"],
        "toImprove": ["máximo 3 pontos específicos para melhorar"],
        "recommendations": ["máximo 3 recomendações práticas"],
        "performanceInsights": {
          "efficiency": "análise da eficiência do treino",
          "pacing": "análise do ritmo e distribuição de esforço",
          "heartRateAnalysis": "análise da frequência cardíaca",
          "effortDistribution": "análise da distribuição do esforço"
        },
        "recoveryGuidance": {
          "estimatedRecoveryTime": "tempo estimado de recuperação",
          "nextWorkoutSuggestions": "sugestões para próximo treino",
          "nutritionTips": "dicas de nutrição pós-treino"
        }
      }
      
      Seja específico, prático e focado nos dados apresentados. Use linguagem motivacional mas realista.
    `;

    console.log('🤖 AI Analysis: Sending request to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'Você é um especialista em análise de performance esportiva. Analise os dados de treino e forneça insights práticos e motivacionais em português brasileiro. Responda APENAS com JSON válido, sem markdown ou formatação adicional.'
          },
          {
            role: 'user',
            content: basePrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('Failed to analyze workout with AI');
    }

    const aiResponse = await response.json();
    const analysisContent = aiResponse.choices[0].message.content;
    
    console.log('🤖 AI Analysis: Received response, parsing...');

    // Parse the JSON response
    let analysis: WorkoutAnalysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response:', analysisContent);
      
      // Fallback analysis if parsing fails
      analysis = {
        whatWorked: ['Treino concluído com sucesso', 'Dados coletados corretamente'],
        toImprove: ['Aguarde nova análise para insights específicos'],
        recommendations: ['Continue mantendo consistência nos treinos'],
        performanceInsights: {
          efficiency: 'Análise detalhada em processamento',
          pacing: 'Dados sendo processados',
          heartRateAnalysis: 'Avaliação em andamento',
          effortDistribution: 'Cálculos sendo realizados'
        },
        recoveryGuidance: {
          estimatedRecoveryTime: '18-24 horas',
          nextWorkoutSuggestions: 'Baseado no tipo de atividade',
          nutritionTips: 'Hidratação e nutrição adequada'
        }
      };
    }

    console.log('🤖 AI Analysis: Successfully completed analysis');

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-workout function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});