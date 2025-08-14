import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VariationAnalysisRequest {
  activityId: string;
  activitySource: string;
  userId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { activityId, activitySource, userId }: VariationAnalysisRequest = await req.json();

    console.log(`🚀 Iniciando cálculo de análise de variação: ${activityId} (${activitySource})`);

    // Verificar se já existe cache válido
    const { data: existingCache } = await supabaseClient
      .from('variation_analysis_cache')
      .select('*')
      .eq('activity_id', activityId)
      .eq('activity_source', activitySource)
      .single();

    if (existingCache) {
      console.log(`✅ Cache encontrado para ${activityId}`);
      return new Response(
        JSON.stringify({
          success: true,
          data: existingCache,
          source: 'cache'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados da atividade baseado na fonte
    let activityData: any[] = [];
    let userIdToUse = userId;

    if (activitySource === 'GARMIN') {
      const { data: garminData, error } = await supabaseClient
        .from('garmin_activity_details')
        .select('user_id, heart_rate, speed_meters_per_second, sample_timestamp')
        .eq('activity_id', activityId)
        .not('heart_rate', 'is', null)
        .order('sample_timestamp', { ascending: true })
        .limit(200);

      if (error) throw error;
      activityData = garminData || [];
      if (activityData.length > 0) userIdToUse = activityData[0].user_id;
    } else if (activitySource === 'STRAVA') {
      const { data: stravaData, error } = await supabaseClient
        .from('strava_activity_streams')
        .select('user_id, heartrate, velocity_smooth, time')
        .eq('strava_activity_id', activityId)
        .not('heartrate', 'is', null)
        .order('time', { ascending: true })
        .limit(200);

      if (error) throw error;
      activityData = stravaData?.map(d => ({
        user_id: d.user_id,
        heart_rate: d.heartrate,
        speed_meters_per_second: d.velocity_smooth,
        sample_timestamp: d.time
      })) || [];
      if (activityData.length > 0) userIdToUse = activityData[0].user_id;
    } else if (activitySource === 'POLAR') {
      const { data: polarData, error } = await supabaseClient
        .from('polar_activity_details')
        .select('user_id, heart_rate, speed_meters_per_second, sample_timestamp')
        .eq('activity_id', activityId)
        .not('heart_rate', 'is', null)
        .order('sample_timestamp', { ascending: true })
        .limit(200);

      if (error) throw error;
      activityData = polarData || [];
      if (activityData.length > 0) userIdToUse = activityData[0].user_id;
    }

    if (!activityData.length || !userIdToUse) {
      throw new Error('Dados insuficientes para análise');
    }

    // Calcular análise de variação
    const heartRates = activityData.map(d => d.heart_rate).filter(hr => hr > 0);
    const speeds = activityData
      .map(d => d.speed_meters_per_second)
      .filter(s => s != null && s > 0)
      .map(s => (3.6 / s) * 60); // Converter para pace em min/km

    // Calcular CV para Heart Rate
    const hrMean = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
    const hrStdDev = Math.sqrt(heartRates.reduce((sum, hr) => sum + Math.pow(hr - hrMean, 2), 0) / heartRates.length);
    const heartRateCV = (hrStdDev / hrMean) * 100;

    // Calcular CV para Pace
    let paceCV = null;
    if (speeds.length > 0) {
      const paceMean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const paceStdDev = Math.sqrt(speeds.reduce((sum, pace) => sum + Math.pow(pace - paceMean, 2), 0) / speeds.length);
      paceCV = (paceStdDev / paceMean) * 100;
    }

    // Categorizar CVs
    const heartRateCategory = heartRateCV < 10 ? 'Baixo' : 'Alto';
    const paceCategory = paceCV ? (paceCV < 15 ? 'Baixo' : 'Alto') : null;

    // Gerar diagnóstico
    let diagnosis = '';
    if (heartRateCategory === 'Baixo' && paceCategory === 'Baixo') {
      diagnosis = 'Ritmo consistente e controle cardíaco excelente';
    } else if (heartRateCategory === 'Baixo' && paceCategory === 'Alto') {
      diagnosis = 'Bom controle cardíaco, mas ritmo inconsistente';
    } else if (heartRateCategory === 'Alto' && paceCategory === 'Baixo') {
      diagnosis = 'Ritmo consistente, mas variabilidade cardíaca alta';
    } else {
      diagnosis = 'Treino com alta variabilidade tanto no ritmo quanto na frequência cardíaca';
    }

    const analysisResult = {
      user_id: userIdToUse,
      activity_id: activityId,
      activity_source: activitySource,
      heart_rate_cv: Math.round(heartRateCV * 100) / 100,
      heart_rate_category: heartRateCategory,
      pace_cv: paceCV ? Math.round(paceCV * 100) / 100 : null,
      pace_category: paceCategory,
      diagnosis,
      has_heart_rate_data: heartRates.length > 0,
      has_pace_data: speeds.length > 0,
      data_points_count: activityData.length
    };

    // Salvar no cache
    const { error: insertError } = await supabaseClient
      .from('variation_analysis_cache')
      .insert(analysisResult);

    if (insertError) {
      console.error('Erro ao salvar cache:', insertError);
    }

    console.log(`✅ Análise de variação calculada e salva: ${activityId}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: analysisResult,
        source: 'calculated'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na análise de variação:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});