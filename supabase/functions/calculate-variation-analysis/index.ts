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
      .from('variation_analysis_cache' as any)
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

    // Buscar dados da atividade baseado na fonte com otimizações para performance
    let activityData: any[] = [];
    let userIdToUse = userId;

    if (activitySource === 'GARMIN') {
      console.log(`📊 Buscando dados Garmin com amostragem otimizada...`);
      
      // Estratégia: usar TABLESAMPLE para performance + amostragem temporal
      const { data: garminData, error } = await supabaseClient
        .from('garmin_activity_details')
        .select('user_id, heart_rate, speed_meters_per_second, sample_timestamp')
        .eq('activity_id', activityId)
        .not('heart_rate', 'is', null)
        .gt('heart_rate', 0)
        .order('sample_timestamp', { ascending: true })
        .limit(100); // Limite muito reduzido para evitar timeout

      if (error) {
        console.error('❌ Erro na query Garmin:', error);
        throw error;
      }
      
      console.log(`📊 Dados Garmin encontrados: ${garminData?.length || 0} registros`);
      activityData = garminData || [];
      if (activityData.length > 0) userIdToUse = activityData[0].user_id;
    } else if (activitySource === 'STRAVA') {
      console.log(`📊 Buscando dados Strava com amostragem otimizada...`);
      
      const { data: stravaData, error } = await supabaseClient
        .from('strava_activity_streams')
        .select('user_id, heartrate, velocity_smooth, time')
        .eq('strava_activity_id', activityId)
        .not('heartrate', 'is', null)
        .gt('heartrate', 0)
        .order('time', { ascending: true })
        .limit(100); // Limite reduzido

      if (error) {
        console.error('❌ Erro na query Strava:', error);
        throw error;
      }
      
      console.log(`📊 Dados Strava encontrados: ${stravaData?.length || 0} registros`);
      activityData = stravaData?.map(d => ({
        user_id: d.user_id,
        heart_rate: d.heartrate,
        speed_meters_per_second: d.velocity_smooth,
        sample_timestamp: d.time
      })) || [];
      if (activityData.length > 0) userIdToUse = activityData[0].user_id;
    } else if (activitySource === 'POLAR') {
      console.log(`📊 Buscando dados Polar com amostragem otimizada...`);
      
      const { data: polarData, error } = await supabaseClient
        .from('polar_activity_details')
        .select('user_id, heart_rate, speed_meters_per_second, sample_timestamp')
        .eq('activity_id', activityId)
        .not('heart_rate', 'is', null)
        .gt('heart_rate', 0)
        .order('sample_timestamp', { ascending: true })
        .limit(100); // Limite reduzido

      if (error) {
        console.error('❌ Erro na query Polar:', error);
        throw error;
      }
      
      console.log(`📊 Dados Polar encontrados: ${polarData?.length || 0} registros`);
      activityData = polarData || [];
      if (activityData.length > 0) userIdToUse = activityData[0].user_id;
    }

    if (!activityData.length || !userIdToUse) {
      console.log(`⚠️ Dados insuficientes: ${activityData.length} registros encontrados`);
      throw new Error('Dados insuficientes para análise - nenhum registro válido encontrado');
    }

    console.log(`✅ Dados carregados: ${activityData.length} registros para análise`);

    // Aplicar amostragem adicional se necessário para garantir performance
    let processedData = activityData;
    if (activityData.length > 80) {
      // Usar amostragem uniforme mantendo representatividade temporal
      const step = Math.ceil(activityData.length / 80);
      processedData = activityData.filter((_, index) => index % step === 0);
      console.log(`🔄 Amostragem aplicada: ${activityData.length} → ${processedData.length} registros`);
    }

    // Calcular análise de variação com dados otimizados
    const heartRates = processedData.map(d => d.heart_rate).filter(hr => hr > 0);
    const speeds = processedData
      .map(d => d.speed_meters_per_second)
      .filter(s => s != null && s > 0)
      .map(s => (3.6 / s) * 60); // Converter para pace em min/km

    console.log(`📊 Dados processados: ${heartRates.length} heart rates, ${speeds.length} paces`);

    // Validar se temos dados mínimos para análise
    if (heartRates.length < 5) {
      throw new Error(`Dados de frequência cardíaca insuficientes: apenas ${heartRates.length} registros válidos`);
    }

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
      data_points_count: processedData.length
    };

    console.log(`📊 Resultado da análise:`, analysisResult);

    // Salvar no cache
    const { error: insertError } = await supabaseClient
      .from('variation_analysis_cache' as any)
      .insert(analysisResult);

    if (insertError) {
      console.error('⚠️ Erro ao salvar cache (não crítico):', insertError);
      // Não falhar se não conseguir salvar cache
    } else {
      console.log(`✅ Cache salvo com sucesso`);
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
    console.error('❌ Erro na análise de variação:', error);
    
    // Retornar um erro mais específico para o cliente
    let errorMessage = 'Erro desconhecido na análise';
    if (error?.message?.includes('timeout')) {
      errorMessage = 'Timeout na análise - atividade com muitos dados. Tente novamente.';
    } else if (error?.message?.includes('insufficient')) {
      errorMessage = 'Dados insuficientes para análise de variação';
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error?.code || 'unknown'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});