import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';
import { handleError } from '../_shared/error-handler.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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
  deepAnalysis: {
    consistencyDiagnosis: {
      heartRateConsistency: string;
      paceConsistency: string;
      overallConsistency: string;
    };
    segmentAnalysis: {
      problemSegments: Array<{
        segmentNumber: number;
        issue: string;
        recommendation: string;
      }>;
      bestSegments: Array<{
        segmentNumber: number;
        strength: string;
      }>;
    };
    variationInsights: {
      paceVariation: string;
      heartRateVariation: string;
      diagnosis: string;
      recommendations: string[];
    };
    technicalInsights: {
      runningEconomy: string;
      fatiguePattern: string;
      tacticalAnalysis: string;
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

  return await handleError('analyze-workout', async () => {
    console.log('🤖 AI Analysis: Function started successfully');
    
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found');
      throw new Error('OpenAI API key not configured');
    }
    
    // Create user client for auth and a service client for privileged operations
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase clients created');

    // Get user info using the user client
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      throw new Error('Invalid authorization');
    }

    console.log('🤖 AI Analysis: Starting analysis for activity:', activityId, 'User:', user.id);

    // Try to get workout data from multiple sources (Garmin, then Strava, then Polar)
    let activity: any = null;
    let activitySource = '';
    
    // Try Garmin first
    const { data: garminActivity } = await serviceSupabase
      .from('garmin_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
      .maybeSingle();
    
    if (garminActivity) {
      activity = garminActivity;
      activitySource = 'garmin';
      console.log('🔍 Found Garmin activity for analysis');
    } else {
      // Try Strava if Garmin not found
      const { data: stravaActivity } = await serviceSupabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('strava_activity_id', activityId)
        .maybeSingle();
        
      if (stravaActivity) {
        activity = {
          activity_type: stravaActivity.type,
          duration_in_seconds: stravaActivity.elapsed_time,
          distance_in_meters: stravaActivity.distance * 1000, // Convert km to meters
          average_heart_rate_in_beats_per_minute: stravaActivity.average_heartrate,
          max_heart_rate_in_beats_per_minute: stravaActivity.max_heartrate,
          average_speed_in_meters_per_second: stravaActivity.average_speed,
          max_speed_in_meters_per_second: stravaActivity.max_speed,
          active_kilocalories: stravaActivity.calories,
          total_elevation_gain_in_meters: stravaActivity.total_elevation_gain,
          activity_id: activityId,
          activity_name: stravaActivity.name,
        };
        activitySource = 'strava';
        console.log('🔍 Found Strava activity for analysis');
      } else {
        // Try Polar if Strava not found
        // First by internal UUID
        let { data: polarActivity } = await serviceSupabase
          .from('polar_activities')
          .select('*')
          .eq('user_id', user.id)
          .eq('id', activityId)
          .maybeSingle();
        
        // If not found, try by external activity_id
        if (!polarActivity) {
          const byExternal = await serviceSupabase
            .from('polar_activities')
            .select('*')
            .eq('user_id', user.id)
            .eq('activity_id', activityId)
            .maybeSingle();
          polarActivity = byExternal.data;
        }
        
        if (polarActivity) {
          const durationVal = typeof polarActivity.duration === 'number' 
            ? polarActivity.duration 
            : (!isNaN(Number(polarActivity.duration)) ? Number(polarActivity.duration) : null);

          activity = {
            activity_type: polarActivity.sport || polarActivity.activity_type,
            duration_in_seconds: durationVal,
            distance_in_meters: polarActivity.distance ? Number(polarActivity.distance) : null,
            average_heart_rate_in_beats_per_minute: null,
            max_heart_rate_in_beats_per_minute: null,
            average_speed_in_meters_per_second: null,
            max_speed_in_meters_per_second: null,
            active_kilocalories: polarActivity.calories,
            total_elevation_gain_in_meters: null,
            activity_id: polarActivity.id,
            activity_name: polarActivity.sport || 'Polar Workout',
          };
          activitySource = 'polar';
          console.log('🔍 Found Polar activity for analysis');
        } else {
          // Try GPX imported activities
          const { data: gpxActivity } = await serviceSupabase
            .from('strava_gpx_activities')
            .select('*')
            .eq('user_id', user.id)
            .eq('activity_id', activityId)
            .maybeSingle();

          if (gpxActivity) {
            activity = {
              activity_type: gpxActivity.activity_type,
              duration_in_seconds: gpxActivity.duration_in_seconds,
              distance_in_meters: gpxActivity.distance_in_meters,
              average_heart_rate_in_beats_per_minute: gpxActivity.average_heart_rate,
              max_heart_rate_in_beats_per_minute: gpxActivity.max_heart_rate,
              average_speed_in_meters_per_second: gpxActivity.average_speed_in_meters_per_second,
              max_speed_in_meters_per_second: null,
              active_kilocalories: gpxActivity.calories || null,
              total_elevation_gain_in_meters: gpxActivity.total_elevation_gain_in_meters || null,
              activity_id: gpxActivity.activity_id,
              activity_name: gpxActivity.name || 'GPX Workout',
            };
            activitySource = 'gpx';
            console.log('🔍 Found GPX activity for analysis');
          } else {
            // Try Zepp GPX activities
            const { data: zeppActivity } = await serviceSupabase
              .from('zepp_gpx_activities')
              .select('*')
              .eq('user_id', user.id)
              .eq('activity_id', activityId)
              .maybeSingle();

            if (zeppActivity) {
              activity = {
                activity_type: zeppActivity.activity_type,
                duration_in_seconds: zeppActivity.duration_in_seconds,
                distance_in_meters: zeppActivity.distance_in_meters,
                average_heart_rate_in_beats_per_minute: zeppActivity.average_heart_rate,
                max_heart_rate_in_beats_per_minute: zeppActivity.max_heart_rate,
                average_speed_in_meters_per_second: zeppActivity.average_speed_ms,
                max_speed_in_meters_per_second: zeppActivity.max_speed_ms || null,
                active_kilocalories: zeppActivity.calories || null,
                total_elevation_gain_in_meters: zeppActivity.elevation_gain_meters || null,
                activity_id: zeppActivity.activity_id,
                activity_name: zeppActivity.name || 'Zepp Workout',
              };
              activitySource = 'zepp_gpx';
              console.log('🔍 Found Zepp GPX activity for analysis');
            }
          }
        }
      }
    }

    if (!activity) {
      throw new Error('Activity not found in any source');
    }

    // Get detailed workout data (Garmin or GPX)
    let activityDetails: any[] = [];
    if (activitySource === 'garmin') {
      const { data: details, error: detailsError } = await serviceSupabase
        .from('garmin_activity_details')
        .select('activity_name, heart_rate, speed_meters_per_second, elevation_in_meters, power_in_watts, sample_timestamp')
        .eq('user_id', user.id)
        .eq('activity_id', activityId)
        .order('sample_timestamp', { ascending: true })
        .limit(500); // Limit for performance

      if (detailsError) {
        console.error('Error fetching Garmin activity details:', detailsError);
      } else {
        activityDetails = details || [];
      }
    } else if (activitySource === 'gpx') {
      const { data: details, error: detailsError } = await serviceSupabase
        .from('strava_gpx_activity_details')
        .select('heart_rate, speed_meters_per_second, elevation_in_meters, sample_timestamp, total_distance_in_meters')
        .eq('activity_id', activityId)
        .order('sample_timestamp', { ascending: true })
        .limit(500);
      if (detailsError) {
        console.error('Error fetching GPX activity details:', detailsError);
      } else {
        activityDetails = details || [];
      }
    } else if (activitySource === 'zepp_gpx') {
      const { data: details, error: detailsError } = await serviceSupabase
        .from('zepp_gpx_activity_details')
        .select('heart_rate, speed_meters_per_second, elevation_in_meters, sample_timestamp, total_distance_in_meters')
        .eq('activity_id', activityId)
        .eq('user_id', user.id)
        .order('sample_timestamp', { ascending: true })
        .limit(500);
      if (detailsError) {
        console.error('Error fetching Zepp GPX activity details:', detailsError);
      } else {
        activityDetails = details || [];
      }
    }
    
    console.log(`📊 Activity source: ${activitySource}, detailed data points: ${activityDetails.length}`);

    // Get user profile for context
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('birth_date, weight_kg, height_cm')
      .eq('user_id', user.id)
      .single();

    // FASE 2: ANÁLISE PROFUNDA - Buscar dados adicionais
    console.log('🤖 Deep Analysis: Fetching additional data for comprehensive analysis...');

    // 1. Buscar dados de histograma (activity_chart_data)
    let histogramData: any = null;
    const { data: chartData } = await serviceSupabase
      .from('activity_chart_data')
      .select('series_data, data_points_count, avg_heart_rate, avg_pace_min_km, activity_source')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (chartData && chartData.series_data) {
      histogramData = {
        totalPoints: chartData.data_points_count,
        avgHeartRate: chartData.avg_heart_rate,
        avgPace: chartData.avg_pace_min_km,
        source: chartData.activity_source,
        samples: Array.isArray(chartData.series_data) ? chartData.series_data.slice(0, 100) : [] // Limitar amostras para prompt
      };
      console.log(`✅ Histogram data found: ${histogramData.totalPoints} points from ${histogramData.source}`);
    }

    // 2. Buscar segmentos de 1km (activity_segments)
    // Variáveis auxiliares para garantir consistência nos segmentos de 1km
    let segmentsData: any[] = [];
    let bestKmSegmentHumanNumber: number | null = null;
    let bestKmSegmentRawNumber: number | null = null;
    let bestKmSegmentPace: number | null = null;
    let isZeroBasedSegments = false;
    let problemKmSegments: Array<{ human: number; pace: number; pct: number } > = [];
    const { data: segments } = await serviceSupabase
      .from('activity_segments')
      .select('segment_number, avg_heart_rate, avg_pace_min_km, duration_seconds, elevation_gain_meters')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .order('segment_number');

    if (segments && segments.length > 0) {
      segmentsData = segments;
      console.log(`✅ Segment data found: ${segments.length} segments`);

      // Calcular o melhor segmento de 1km (pace médio mais baixo)
      const validSegments = segmentsData.filter(s => typeof s.avg_pace_min_km === 'number');
      if (validSegments.length > 0) {
        const minRaw = Math.min(...segmentsData.map(s => s.segment_number));
        isZeroBasedSegments = minRaw === 0;
        const best = [...validSegments].sort((a, b) => (a.avg_pace_min_km as number) - (b.avg_pace_min_km as number))[0];
        bestKmSegmentRawNumber = best.segment_number;
        bestKmSegmentHumanNumber = isZeroBasedSegments ? best.segment_number + 1 : best.segment_number;
        bestKmSegmentPace = best.avg_pace_min_km as number;
        console.log(`🏅 Ground-truth best 1km segment: raw=${bestKmSegmentRawNumber}, human=${bestKmSegmentHumanNumber}, pace=${bestKmSegmentPace}`);

        // Baseline pela mediana do pace de 1km e detecção de segmentos problemáticos (>=10% mais lentos)
        const paces = [...validSegments]
          .map(s => s.avg_pace_min_km as number)
          .filter(p => typeof p === 'number')
          .sort((a,b) => a-b);
        if (paces.length >= 3) {
          const mid = Math.floor(paces.length / 2);
          const median = paces.length % 2 === 0 ? (paces[mid - 1] + paces[mid]) / 2 : paces[mid];
          const threshold = median * 1.10; // 10% mais lento que a mediana
          const problems = validSegments
            .filter(s => (s.avg_pace_min_km as number) >= threshold)
            .map(s => {
              const human = isZeroBasedSegments ? s.segment_number + 1 : s.segment_number;
              const pace = s.avg_pace_min_km as number;
              const pct = ((pace / median) - 1) * 100;
              return { human, pace, pct };
            })
            // não marcar como problemático o próprio melhor KM
            .filter(p => p.human !== bestKmSegmentHumanNumber)
            // ordenar pelo maior desvio
            .sort((a,b) => b.pct - a.pct)
            .slice(0, 3);
          problemKmSegments = problems;
          console.log('⚠️ Problem KM candidates (median baseline):', problemKmSegments);
        }
      }
    }

    // 3. Buscar análise de variação (activity_variation_analysis)
    let variationData: any = null;
    const { data: variation } = await serviceSupabase
      .from('activity_variation_analysis')
      .select('heart_rate_cv, pace_cv, heart_rate_cv_category, pace_cv_category, diagnosis, has_valid_data, data_points')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (variation) {
      variationData = variation;
      console.log(`✅ Variation analysis found: HR CV=${variation.heart_rate_cv}, Pace CV=${variation.pace_cv}`);
    }

    // 4. Buscar melhores segmentos (activity_best_segments)
    let bestSegmentsData: any = null;
    const { data: bestSegments } = await serviceSupabase
      .from('activity_best_segments')
      .select('best_1km_pace_min_km, segment_start_distance_meters, segment_end_distance_meters, segment_duration_seconds')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (bestSegments) {
      bestSegmentsData = bestSegments;
      console.log(`✅ Best segments found: Best 1km pace=${bestSegments.best_1km_pace_min_km}`);
    }

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

    // Check if this is a high-intensity workout based on activity name
    const activityName = (activityDetails?.[0]?.activity_name || activity.activity_name || '').toLowerCase();
    const highIntensityKeywords = ['limite', 'vo2', 'superséries', 'superseries', 'corrida de tempo', 'sprint', 'interval', 'threshold', 'tempo'];
    const isHighIntensityWorkout = highIntensityKeywords.some(keyword => activityName.includes(keyword));
    
    // Additional analysis for limited data scenarios (Strava)
    const isLimitedData = activitySource === 'strava' || activityDetails.length === 0;
    console.log(`📊 Data analysis: source=${activitySource}, limited=${isLimitedData}, highIntensity=${isHighIntensityWorkout}`);

    // Prepare analysis data with deep analysis components
    const analysisData = {
      activity: {
        type: activity.activity_type,
        name: activityDetails?.[0]?.activity_name,
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
        isHighIntensity: isHighIntensityWorkout,
      },
      userContext: {
        age: userAge,
        weight: profile?.weight_kg,
        height: profile?.height_cm,
      },
      detailedData: activityDetails || [],
      // FASE 2: Deep Analysis Data
      deepAnalysisData: {
        histogram: histogramData,
        segments: segmentsData,
        variation: variationData,
        bestSegments: bestSegmentsData,
      },
    };

    // Create specialized prompts based on data availability and activity type
    const limitedDataContext = isLimitedData ? `
      
      ⚠️ DADOS LIMITADOS (${activitySource.toUpperCase()}): 
      Esta análise é baseada em dados básicos de tempo, distância e pace. Sem dados detalhados de frequência cardíaca ou power,
      foque em análises de:
      - Consistência de pace e ritmo
      - Eficiência de movimento (distância/tempo)
      - Padrões de performance baseados em métricas básicas
      - Progressão temporal e comparações históricas
      - Adaptação ao terreno baseada em elevação
      - Recomendações práticas para melhoria
      
      Seja criativo com os dados disponíveis e forneça insights valiosos mesmo com informações limitadas.
    ` : '';

    const basePrompt = `
      Analise os dados do treino de ${activity.activity_type || 'exercício'} e forneça insights detalhados em português brasileiro.
      
      📊 FONTE DOS DADOS: ${activitySource.toUpperCase()} ${isLimitedData ? '(DADOS LIMITADOS)' : '(DADOS COMPLETOS)'}
      
      Dados do treino:
      - Tipo: ${activity.activity_type}
      ${activity.activity_name ? `- Nome: ${activity.activity_name}` : ''}
      - Duração: ${Math.round((activity.duration_in_seconds || 0) / 60)} minutos
      - Distância: ${((activity.distance_in_meters || 0) / 1000).toFixed(1)} km
       - FC média: ${activity.average_heart_rate_in_beats_per_minute || 'N/A'} bpm
       - FC máxima: ${activity.max_heart_rate_in_beats_per_minute || 'N/A'} bpm
       - Pace médio: ${formattedPace} min/km (${calculatedPaceFromDistance?.toFixed(3) || 'N/A'} min/km decimal)
       ${calculatedPaceFromSpeed ? `- Pace da velocidade: ${formatPace(calculatedPaceFromSpeed)} min/km` : ''}
       ${storedPace ? `- Pace armazenado: ${formatPace(storedPace)} min/km` : ''}${paceAnalysis}
      - Calorias: ${activity.active_kilocalories || 'N/A'} kcal
      - Elevação: ${activity.total_elevation_gain_in_meters || 0}m
      ${limitedDataContext}
      
      ${isHighIntensityWorkout ? '⚠️ IMPORTANTE: Este é um treino de ALTA INTENSIDADE (detectado pelas palavras-chave). Em treinos desta natureza, variações de pace e frequência cardíaca são ESPERADAS e NORMAIS, pois há momentos de esforço intenso alternados com períodos de recuperação. Considere isso na análise e não trate as variações como problemas, mas sim como características do tipo de treino.' : ''}
      
      ${userAge ? `Idade do usuário: ${userAge} anos` : ''}
      ${profile?.weight_kg ? `Peso: ${profile.weight_kg}kg` : ''}
      
      🔬 DADOS PARA ANÁLISE PROFUNDA (FASE 2):
      
      ${histogramData ? `
      📊 HISTOGRAMA DE CONSISTÊNCIA:
      - Total de pontos: ${histogramData.totalPoints}
      - FC média: ${histogramData.avgHeartRate || 'N/A'} bpm
      - Pace média: ${histogramData.avgPace || 'N/A'} min/km
      - Fonte: ${histogramData.source}
      - Amostras (primeiras 100): ${JSON.stringify(histogramData.samples.slice(0, 20))}...
      ` : ''}
      
      ${segmentsData.length > 0 ? `
      🏃 ANÁLISE POR SEGMENTOS DE 1KM:
      ${segmentsData.map((seg, i) => `
      - Segmento ${seg.segment_number}: FC ${seg.avg_heart_rate || 'N/A'} bpm, Pace ${seg.avg_pace_min_km || 'N/A'} min/km, Duração ${seg.duration_seconds}s, Elevação +${seg.elevation_gain_meters || 0}m`).join('')}
      ` : ''}
      
      ${variationData ? `
      📈 ANÁLISE DE VARIAÇÃO:
      - Coeficiente de Variação FC: ${(variationData.heart_rate_cv * 100)?.toFixed(1) || 'N/A'}% (${variationData.heart_rate_cv_category})
      - Coeficiente de Variação Pace: ${(variationData.pace_cv * 100)?.toFixed(1) || 'N/A'}% (${variationData.pace_cv_category})
      - Diagnóstico automático: ${variationData.diagnosis}
      - Pontos de dados: ${variationData.data_points}
      ` : ''}
      
      ${bestSegmentsData ? `
      🏆 MELHOR SEGMENTO:
      - Melhor 1km: ${bestSegmentsData.best_1km_pace_min_km} min/km
      - Distância: ${bestSegmentsData.segment_start_distance_meters}m - ${bestSegmentsData.segment_end_distance_meters}m
      - Duração: ${bestSegmentsData.segment_duration_seconds}s
      ` : ''}
      
      ${segmentsData.length > 0 && bestKmSegmentHumanNumber !== null ? `
      ✅ VERDADE TERRENA (GROUND TRUTH) - Segmentos de 1km:
      - Indexação exibida ao usuário: baseada em 1 (KM 1, KM 2, ...)
      - Melhor KM (por pace médio em 1km): KM ${bestKmSegmentHumanNumber} (${(bestKmSegmentPace || 0).toFixed(2)} min/km)
      - Não contradiga esta informação nos campos segmentAnalysis; utilize exatamente este número de segmento (humano).
      ${problemKmSegments.length > 0 ? `\n      ⚠️ Segmentos potencialmente problemáticos (comparados à mediana dos 1km):\n      ${problemKmSegments.map(p => `- KM ${p.human}: ${p.pace.toFixed(2)} min/km (+${p.pct.toFixed(1)}%)`).join('\n')}` : ''}
      ` : ''}
      
      INSTRUÇÕES ESPECIAIS PARA DADOS LIMITADOS:
      ${isLimitedData ? `
      - Analise a CONSISTÊNCIA DO PACE: variação, estabilidade, padrões
      - Calcule EFICIÊNCIA DE MOVIMENTO: distância por minuto, economia de energia
      - Avalie PROGRESSÃO TEMPORAL: inicio vs meio vs final do treino
      - Identifique PADRÕES DE TERRENO: subidas/descidas baseado em elevação
      - Sugira MELHORIAS ESPECÍFICAS baseadas nos dados disponíveis
      - Use ANÁLISE CONTEXTUAL: tipo de atividade, duração, condições
      - Forneça RECOMENDAÇÕES PRÁTICAS mesmo com dados limitados
      - Seja CRIATIVO e PERSPICAZ com os insights
      ` : 'Use todos os dados detalhados disponíveis para uma análise completa.'}
      
      INSTRUÇÕES PARA ANÁLISE PROFUNDA:
      ${histogramData || segmentsData.length > 0 || variationData ? `
      🎯 ANÁLISE DE CONSISTÊNCIA: Use os dados do histograma para diagnosticar:
      - Padrões de FC e pace ao longo do tempo
      - Identificar momentos de instabilidade ou picos anômalos
      - Avaliar a distribuição estatística dos dados
      
      🏃 DETECÇÃO DE SEGMENTOS PROBLEMA: Use os dados de segmentos de 1km para:
      - Identificar segmentos com performance abaixo da média
      - Detectar fadiga progressiva ou recuperação inadequada
      - Correlacionar elevação com performance
      
      📊 INSIGHTS DE VARIAÇÃO: Use os coeficientes de variação para:
      - Explicar o tipo de treino baseado na variabilidade
      - Sugerir melhorias na estratégia de pacing
      - Identificar padrões de inconsistência
      ` : ''}
      
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
        },
        "deepAnalysis": {
          "consistencyDiagnosis": {
            "heartRateConsistency": "diagnóstico da consistência da FC baseado nos dados do histograma",
            "paceConsistency": "diagnóstico da consistência do pace baseado nos dados do histograma",
            "overallConsistency": "diagnóstico geral de consistência"
          },
          "segmentAnalysis": {
            "problemSegments": [
              {
                "segmentNumber": 1,
                "issue": "descrição do problema identificado",
                "recommendation": "recomendação específica para o segmento"
              }
            ],
            "bestSegments": [
              {
                "segmentNumber": 1,
                "strength": "o que funcionou bem neste segmento"
              }
            ]
          },
          "variationInsights": {
            "paceVariation": "análise da variação do pace usando CV",
            "heartRateVariation": "análise da variação da FC usando CV",
            "diagnosis": "diagnóstico integrado baseado nos CVs",
            "recommendations": ["recomendações baseadas na análise de variação"]
          },
          "technicalInsights": {
            "runningEconomy": "análise da economia de corrida baseada nos dados disponíveis",
            "fatiguePattern": "padrão de fadiga identificado nos segmentos",
            "tacticalAnalysis": "análise tática da estratégia de prova"
          }
        }
      }
      
      Seja específico, prático e focado nos dados apresentados. Use linguagem motivacional mas realista.
    `;

    console.log('🤖 AI Analysis: Sending request to OpenAI...');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured - please add OPENAI_API_KEY to edge function secrets');
    }

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
            content: `Você é um especialista em análise de performance esportiva especializado em maximizar insights com dados limitados. 
            
            EXPERTISE ESPECIAL:
            - Análise de pace e consistência temporal
            - Eficiência de movimento e economia energética  
            - Padrões de progressão e fadiga
            - Adaptação a terreno e condições
            - Recomendações práticas baseadas em métricas básicas
            - Insights contextuais e preditivos
            
            Para dados limitados (apenas tempo, distância, pace):
            - Seja criativo e perspicaz
            - Foque em padrões e tendências
            - Analise eficiência e consistência
            - Forneça recomendações práticas
            - Use contexto do tipo de atividade
            
            Responda APENAS com JSON válido, sem markdown. Seja específico, prático e motivacional.`
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
      console.log('✅ AI Analysis: JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      console.error('Raw response:', analysisContent);
      
      // Fallback analysis if parsing fails
      analysis = {
        whatWorked: [
          'Treino concluído com sucesso',
          'Distância percorrida conforme planejado',
          'Consistência no ritmo de execução'
        ],
        toImprove: [
          'Análise detalhada temporariamente indisponível',
          'Considere manter a regularidade nos treinos',
          'Monitore a progressão ao longo do tempo'
        ],
        recommendations: [
          'Continue mantendo consistência nos treinos',
          'Varie a intensidade para melhor adaptação',
          'Mantenha hidratação adequada durante exercícios'
        ],
        performanceInsights: {
          efficiency: `Eficiência de movimento: ${activity.distance_in_meters && activity.duration_in_seconds ? ((activity.distance_in_meters / 1000) / (activity.duration_in_seconds / 60)).toFixed(2) + ' km/min' : 'Calculando...'}`,
          pacing: `Pace médio: ${formattedPace} - ${isLimitedData ? 'Baseado em dados básicos' : 'Análise completa disponível'}`,
          heartRateAnalysis: activity.average_heart_rate_in_beats_per_minute ? `FC média: ${activity.average_heart_rate_in_beats_per_minute} bpm - Zona de treino adequada` : 'Dados de FC não disponíveis para esta atividade',
          effortDistribution: `Distribuição do esforço ${isHighIntensityWorkout ? 'adequada para treino de alta intensidade' : 'consistente ao longo da atividade'}`
        },
        recoveryGuidance: {
          estimatedRecoveryTime: activity.duration_in_seconds > 3600 ? '24-48 horas' : '12-24 horas',
          nextWorkoutSuggestions: `Próximo treino: ${activity.activity_type === 'Run' ? 'Corrida leve ou cross-training' : 'Atividade de intensidade moderada'}`,
          nutritionTips: 'Hidratação constante e reposição de carboidratos nas primeiras 2 horas pós-treino'
        },
        deepAnalysis: {
          consistencyDiagnosis: {
            heartRateConsistency: histogramData ? 'Análise baseada em dados parciais' : 'Dados insuficientes para análise detalhada',
            paceConsistency: histogramData ? 'Análise baseada em dados parciais' : 'Dados insuficientes para análise detalhada',
            overallConsistency: 'Análise de fallback - dados limitados'
          },
          segmentAnalysis: {
            problemSegments: [],
            bestSegments: []
          },
          variationInsights: {
            paceVariation: variationData ? `CV Pace: ${(variationData.pace_cv * 100)?.toFixed(1)}%` : 'Dados não disponíveis',
            heartRateVariation: variationData ? `CV FC: ${(variationData.heart_rate_cv * 100)?.toFixed(1)}%` : 'Dados não disponíveis',
            diagnosis: variationData?.diagnosis || 'Diagnóstico não disponível',
            recommendations: ['Mantenha consistência nos treinos futuros']
          },
          technicalInsights: {
            runningEconomy: 'Análise baseada em métricas básicas disponíveis',
            fatiguePattern: 'Padrão de fadiga não detectável com dados atuais',
            tacticalAnalysis: 'Estratégia aparenta ser adequada para o tipo de atividade'
          }
        }
      };
    }

    // Pós-processamento para garantir consistência dos segmentos
    try {
      (analysis as any).deepAnalysis = (analysis as any).deepAnalysis || {};
      const deep = (analysis as any).deepAnalysis;
      deep.segmentAnalysis = deep.segmentAnalysis || { problemSegments: [], bestSegments: [] };

      if (bestKmSegmentHumanNumber !== null) {
        // Remover entradas problemáticas que marcam o melhor KM como lento
        if (Array.isArray(deep.segmentAnalysis.problemSegments)) {
          deep.segmentAnalysis.problemSegments = deep.segmentAnalysis.problemSegments.filter((p: any) => p && p.segmentNumber !== bestKmSegmentHumanNumber);
        }

        // Substituir melhores segmentos pelo número correto (humano)
        deep.segmentAnalysis.bestSegments = [
          { segmentNumber: bestKmSegmentHumanNumber, strength: `Melhor pace de 1km confirmado (KM ${bestKmSegmentHumanNumber})` }
        ];
        console.log(`🔧 Consistency fix applied: best KM (human) = ${bestKmSegmentHumanNumber}`);
      }

      // Definir segmentos problemáticos determinísticos (>=10% mais lentos que a mediana)
      if (problemKmSegments && problemKmSegments.length > 0) {
        deep.segmentAnalysis.problemSegments = problemKmSegments.map(p => ({
          segmentNumber: p.human,
          issue: `Pace ${p.pct.toFixed(1)}% mais lento que a mediana de 1km`,
          recommendation: 'Ajustar ritmo; buscar transições mais suaves entre KMs'
        }));
        console.log('🔧 Problem segments set from ground truth:', deep.segmentAnalysis.problemSegments);
      }
    } catch (e) {
      console.warn('⚠️ Consistency fix failed:', e);
    }

    console.log('🤖 AI Analysis: Successfully completed analysis');

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }, {
    userId: token,
    requestData: { activityId }
  });
});