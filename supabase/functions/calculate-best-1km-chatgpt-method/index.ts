import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DataPoint {
  distance: number;
  time: number;
}

interface BestSegmentResult {
  inicio_metros: number;
  fim_metros: number;
  tempo_inicio_segundos: number;
  tempo_fim_segundos: number;
  melhor_pace_min_km: number;
}

function calculateBestSegmentChatGPTMethod(distancia: number[], tempo: number[]): BestSegmentResult | null {
  if (distancia.length !== tempo.length || distancia.length < 2) {
    console.log("❌ Arrays de distância e tempo devem ter o mesmo tamanho e pelo menos 2 pontos");
    return null;
  }

  let bestSegment: BestSegmentResult | null = null;
  let bestPace = Infinity;

  console.log(`🔍 Analisando ${distancia.length} pontos para encontrar melhor segmento de 1km`);
  console.log(`📏 Distância total: ${distancia[distancia.length - 1]}m`);

  // Para cada ponto i como ponto inicial
  for (let i = 0; i < distancia.length - 1; i++) {
    const startDistance = distancia[i];
    const startTime = tempo[i];
    const targetDistance = startDistance + 1000; // Adicionar 1km

    // Buscar o primeiro ponto j onde distancia[j] >= distancia[i] + 1000
    for (let j = i + 1; j < distancia.length; j++) {
      const endDistance = distancia[j];
      
      if (endDistance >= targetDistance) {
        const endTime = tempo[j];
        const deltaTime = endTime - startTime;
        const actualDistance = endDistance - startDistance;
        
        // Calcular pace = (delta_tempo / 60) em min/km
        const pace = (deltaTime / 60) * (1000 / actualDistance);
        
        if (pace < bestPace) {
          bestPace = pace;
          bestSegment = {
            inicio_metros: startDistance,
            fim_metros: endDistance,
            tempo_inicio_segundos: startTime,
            tempo_fim_segundos: endTime,
            melhor_pace_min_km: pace
          };
          
          console.log(`🏃 Novo melhor segmento: ${actualDistance.toFixed(1)}m em ${(deltaTime/60).toFixed(2)}min (${pace.toFixed(3)} min/km) [${startTime}s-${endTime}s]`);
        }
        
        // Parar na primeira distância >= 1km encontrada para este ponto inicial
        break;
      }
    }
  }

  if (bestSegment) {
    console.log(`✅ Melhor segmento encontrado: ${bestSegment.melhor_pace_min_km.toFixed(3)} min/km`);
    console.log(`📍 Distância: ${bestSegment.inicio_metros}m - ${bestSegment.fim_metros}m (${(bestSegment.fim_metros - bestSegment.inicio_metros).toFixed(1)}m)`);
    console.log(`⏱️ Tempo: ${bestSegment.tempo_inicio_segundos}s - ${bestSegment.tempo_fim_segundos}s (${bestSegment.tempo_fim_segundos - bestSegment.tempo_inicio_segundos}s)`);
  } else {
    console.log("❌ Nenhum segmento de 1km encontrado");
  }

  return bestSegment;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[calculate-best-1km-chatgpt-method] ${req.method} ${req.url}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { activity_id, user_id } = await req.json();

    if (!activity_id || !user_id) {
      console.log("❌ Missing required parameters: activity_id and user_id");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required parameters: activity_id and user_id" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📊 Processing activity: ${activity_id} for user: ${user_id}`);

    // Fetch GPS data from activity details, ordered by time
    const { data: activityDetails, error: detailsError } = await supabaseClient
      .from('garmin_activity_details')
      .select('total_distance_in_meters, start_time_in_seconds')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .not('total_distance_in_meters', 'is', null)
      .not('start_time_in_seconds', 'is', null)
      .order('start_time_in_seconds', { ascending: true });

    if (detailsError) {
      console.log("❌ Error fetching activity details:", detailsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to fetch activity details: ${detailsError.message}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!activityDetails || activityDetails.length === 0) {
      console.log("❌ No GPS data found for this activity");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No GPS data found for this activity" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`📍 Extracted ${activityDetails.length} GPS points`);

    // Preparar arrays de distância e tempo
    const distancia = activityDetails.map(point => point.total_distance_in_meters);
    const tempo = activityDetails.map(point => point.start_time_in_seconds);

    console.log(`📏 Distância: ${distancia[0]}m a ${distancia[distancia.length - 1]}m`);
    console.log(`⏰ Tempo: ${tempo[0]}s a ${tempo[tempo.length - 1]}s (${(tempo[tempo.length - 1] - tempo[0])/60:.1f} minutos)`);

    // Calcular melhor segmento usando método ChatGPT
    const bestSegment = calculateBestSegmentChatGPTMethod(distancia, tempo);

    if (!bestSegment) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No 1km segment found in this activity" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Salvar resultado na tabela activity_best_segments
    const { error: upsertError } = await supabaseClient
      .from('activity_best_segments')
      .upsert({
        user_id: user_id,
        activity_id: activity_id,
        best_1km_pace_min_km: bestSegment.melhor_pace_min_km,
        segment_start_distance_meters: bestSegment.inicio_metros,
        segment_end_distance_meters: bestSegment.fim_metros,
        segment_duration_seconds: bestSegment.tempo_fim_segundos - bestSegment.tempo_inicio_segundos,
        activity_date: new Date().toISOString().split('T')[0] // Current date as placeholder
      }, {
        onConflict: 'user_id,activity_id'
      });

    if (upsertError) {
      console.log("❌ Error saving best segment:", upsertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to save best segment: ${upsertError.message}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log("✅ Best segment calculated and saved successfully");

    return new Response(
      JSON.stringify({
        success: true,
        bestSegment,
        message: `Best 1km segment: ${bestSegment.melhor_pace_min_km.toFixed(3)} min/km`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});