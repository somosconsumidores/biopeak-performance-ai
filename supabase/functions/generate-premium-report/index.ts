import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';
import { handleError } from '../_shared/error-handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PremiumReportData {
  activityId: string;
  workoutAnalysis: any;
  activityData: any;
  histogramData: any;
  segmentsData: any;
  variationData: any;
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

  // Get request data
  const body = await req.json();
  const { activityId } = body;
  
  if (!activityId) {
    return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return await handleError('generate-premium-report', async () => {
    console.log('📊 Premium Report: Starting generation for activity:', activityId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      throw new Error('Invalid authorization');
    }

    // Check subscription status: allow any active subscriber
    const { data: subscriber, error: subscriberError } = await supabase
      .from('subscribers')
      .select('subscribed, subscription_tier')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subscriberError) {
      console.error('❌ Subscriber query error:', subscriberError);
    }

    if (!subscriber?.subscribed) {
      throw new Error('Premium reports require an active subscription');
    }

    // Get comprehensive workout analysis
    const analysisResult = await supabase.functions.invoke('analyze-workout', {
      body: { activityId }
    });

    if (analysisResult.error) {
      throw new Error(`Failed to get workout analysis: ${analysisResult.error.message}`);
    }

    const workoutAnalysis = analysisResult.data?.analysis;

    // Get activity data from multiple sources
    let activityData: any = null;
    let activitySource = '';

    // Try Garmin first
    const { data: garminActivity } = await supabase
      .from('garmin_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('activity_id', activityId)
      .maybeSingle();

    if (garminActivity) {
      activityData = garminActivity;
      activitySource = 'garmin';
    } else {
      // Try Strava
      const { data: stravaActivity } = await supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('strava_activity_id', activityId)
        .maybeSingle();

      if (stravaActivity) {
        activityData = stravaActivity;
        activitySource = 'strava';
      } else {
        // Try GPX activities
        const { data: gpxActivity } = await supabase
          .from('strava_gpx_activities')
          .select('*')
          .eq('user_id', user.id)
          .eq('activity_id', activityId)
          .maybeSingle();

        if (gpxActivity) {
          activityData = gpxActivity;
          activitySource = 'gpx';
        } else {
          // Try Zepp activities
          const { data: zeppActivity } = await supabase
            .from('zepp_gpx_activities')
            .select('*')
            .eq('user_id', user.id)
            .eq('activity_id', activityId)
            .maybeSingle();

          if (zeppActivity) {
            activityData = zeppActivity;
            activitySource = 'zepp_gpx';
          }
        }
      }
    }

    if (!activityData) {
      throw new Error('Activity not found');
    }

    // Get additional data for comprehensive report
    const { data: histogramData } = await supabase
      .from('activity_chart_data')
      .select('series_data, data_points_count, avg_heart_rate, avg_pace_min_km')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: segmentsData } = await supabase
      .from('activity_segments')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .order('segment_number');

    const { data: variationData } = await supabase
      .from('activity_variation_analysis')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: bestSegments } = await supabase
      .from('activity_best_segments')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
      .maybeSingle();

    // Generate comprehensive HTML report
    const reportHTML = generatePremiumReportHTML({
      activityId,
      workoutAnalysis,
      activityData: { ...activityData, source: activitySource },
      histogramData,
      segmentsData: segmentsData || [],
      variationData,
      bestSegments,
      userEmail: user.email,
      generatedAt: new Date().toISOString()
    });

    console.log('✅ Premium Report: Successfully generated HTML report');

    return new Response(JSON.stringify({ 
      success: true,
      reportHTML,
      metadata: {
        activityId,
        source: activitySource,
        dataPoints: histogramData?.data_points_count || 0,
        segments: segmentsData?.length || 0,
        hasVariationAnalysis: !!variationData,
        generatedAt: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }, {
    userId: token,
    requestData: { activityId }
  });
});

function generatePremiumReportHTML(data: any): string {
  const { activityData, workoutAnalysis, histogramData, segmentsData, variationData, bestSegments, userEmail, generatedAt } = data;
  
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (paceMinKm: number) => {
    const minutes = Math.floor(paceMinKm);
    const seconds = Math.round((paceMinKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BioPeak - Relatório Premium de Análise</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border-left: 4px solid #667eea;
            background: #f8f9ff;
            border-radius: 0 8px 8px 0;
        }
        .section h2 {
            color: #667eea;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 1.4em;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .metric {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .metric-value {
            font-size: 1.8em;
            font-weight: bold;
            color: #667eea;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .insights-list {
            list-style: none;
            padding: 0;
        }
        .insights-list li {
            background: white;
            margin: 10px 0;
            padding: 15px;
            border-radius: 8px;
            border-left: 3px solid #4ade80;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .problem-segment {
            border-left-color: #f87171;
        }
        .best-segment {
            border-left-color: #34d399;
        }
        .variation-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .variation-low {
            background: #dcfce7;
            color: #166534;
        }
        .variation-high {
            background: #fee2e2;
            color: #991b1b;
        }
        .footer {
            background: #f3f4f6;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
        .premium-badge {
            display: inline-block;
            background: linear-gradient(45deg, #ffd700, #ff6b35);
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            margin-left: 10px;
        }
        @media print {
            body { background: white; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>BioPeak <span class="premium-badge">PREMIUM</span></h1>
            <p>Relatório Completo de Análise de Performance</p>
            <p>${new Date(generatedAt).toLocaleDateString('pt-BR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📊 Resumo da Atividade</h2>
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-value">${formatDuration(activityData.duration_in_seconds || activityData.elapsed_time || 0)}</div>
                        <div class="metric-label">Duração</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${((activityData.distance_in_meters || activityData.distance || 0) / 1000).toFixed(1)} km</div>
                        <div class="metric-label">Distância</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${activityData.average_heart_rate_in_beats_per_minute || activityData.average_heartrate || '--'}</div>
                        <div class="metric-label">FC Média (bpm)</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${activityData.average_pace_in_minutes_per_kilometer ? formatPace(activityData.average_pace_in_minutes_per_kilometer) : '--'}</div>
                        <div class="metric-label">Pace Médio</div>
                    </div>
                </div>
            </div>

            ${workoutAnalysis?.deepAnalysis ? `
            <div class="section">
                <h2>🔬 Análise de Consistência</h2>
                <p><strong>Frequência Cardíaca:</strong> ${workoutAnalysis.deepAnalysis.consistencyDiagnosis.heartRateConsistency}</p>
                <p><strong>Ritmo:</strong> ${workoutAnalysis.deepAnalysis.consistencyDiagnosis.paceConsistency}</p>
                <p><strong>Avaliação Geral:</strong> ${workoutAnalysis.deepAnalysis.consistencyDiagnosis.overallConsistency}</p>
            </div>

            ${variationData ? `
            <div class="section">
                <h2>📈 Análise de Variação</h2>
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-value">
                            ${(variationData.heart_rate_cv * 100).toFixed(1)}%
                            <span class="variation-badge ${variationData.heart_rate_cv_category === 'Baixo' ? 'variation-low' : 'variation-high'}">
                                ${variationData.heart_rate_cv_category}
                            </span>
                        </div>
                        <div class="metric-label">Coeficiente de Variação - FC</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">
                            ${(variationData.pace_cv * 100).toFixed(1)}%
                            <span class="variation-badge ${variationData.pace_cv_category === 'Baixo' ? 'variation-low' : 'variation-high'}">
                                ${variationData.pace_cv_category}
                            </span>
                        </div>
                        <div class="metric-label">Coeficiente de Variação - Pace</div>
                    </div>
                </div>
                <p><strong>Diagnóstico:</strong> ${variationData.diagnosis}</p>
            </div>
            ` : ''}

            ${segmentsData.length > 0 ? `
            <div class="section">
                <h2>🏃 Análise por Segmentos (1km)</h2>
                <div class="metrics-grid">
                    ${segmentsData.slice(0, 6).map((segment: any) => `
                    <div class="metric">
                        <div class="metric-value">${segment.avg_pace_min_km ? formatPace(segment.avg_pace_min_km) : '--'}</div>
                        <div class="metric-label">Segmento ${segment.segment_number}</div>
                        <div class="metric-label">${segment.avg_heart_rate || '--'} bpm</div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${workoutAnalysis?.deepAnalysis?.segmentAnalysis ? `
            <div class="section">
                <h2>⚠️ Segmentos Problemáticos</h2>
                <ul class="insights-list">
                    ${workoutAnalysis.deepAnalysis.segmentAnalysis.problemSegments.map((segment: any) => `
                    <li class="problem-segment">
                        <strong>Segmento ${segment.segmentNumber}:</strong> ${segment.issue}
                        <br><em>Recomendação:</em> ${segment.recommendation}
                    </li>
                    `).join('')}
                </ul>

                <h2>🏆 Melhores Segmentos</h2>
                <ul class="insights-list">
                    ${workoutAnalysis.deepAnalysis.segmentAnalysis.bestSegments.map((segment: any) => `
                    <li class="best-segment">
                        <strong>Segmento ${segment.segmentNumber}:</strong> ${segment.strength}
                    </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
            ` : ''}

            <div class="section">
                <h2>💡 Insights de Performance</h2>
                <p><strong>Eficiência:</strong> ${workoutAnalysis?.performanceInsights?.efficiency || 'Análise não disponível'}</p>
                <p><strong>Distribuição de Ritmo:</strong> ${workoutAnalysis?.performanceInsights?.pacing || 'Análise não disponível'}</p>
                <p><strong>Análise Cardíaca:</strong> ${workoutAnalysis?.performanceInsights?.heartRateAnalysis || 'Análise não disponível'}</p>
            </div>

            <div class="section">
                <h2>🎯 O que Funcionou Bem</h2>
                <ul class="insights-list">
                    ${workoutAnalysis?.whatWorked?.map((item: string) => `<li>${item}</li>`).join('') || '<li>Análise não disponível</li>'}
                </ul>
            </div>

            <div class="section">
                <h2>🔧 Pontos de Melhoria</h2>
                <ul class="insights-list">
                    ${workoutAnalysis?.toImprove?.map((item: string) => `<li>${item}</li>`).join('') || '<li>Análise não disponível</li>'}
                </ul>
            </div>

            <div class="section">
                <h2>📋 Recomendações</h2>
                <ul class="insights-list">
                    ${workoutAnalysis?.recommendations?.map((item: string) => `<li>${item}</li>`).join('') || '<li>Análise não disponível</li>'}
                </ul>
            </div>

            ${workoutAnalysis?.deepAnalysis?.technicalInsights ? `
            <div class="section">
                <h2>🔬 Insights Técnicos</h2>
                <p><strong>Economia de Movimento:</strong> ${workoutAnalysis.deepAnalysis.technicalInsights.runningEconomy}</p>
                <p><strong>Padrão de Fadiga:</strong> ${workoutAnalysis.deepAnalysis.technicalInsights.fatiguePattern}</p>
                <p><strong>Análise Tática:</strong> ${workoutAnalysis.deepAnalysis.technicalInsights.tacticalAnalysis}</p>
            </div>
            ` : ''}

            <div class="section">
                <h2>🔄 Orientações de Recuperação</h2>
                <p><strong>Tempo de Recuperação:</strong> ${workoutAnalysis?.recoveryGuidance?.estimatedRecoveryTime || 'Não determinado'}</p>
                <p><strong>Próximo Treino:</strong> ${workoutAnalysis?.recoveryGuidance?.nextWorkoutSuggestions || 'Consulte seu treinador'}</p>
                <p><strong>Nutrição:</strong> ${workoutAnalysis?.recoveryGuidance?.nutritionTips || 'Mantenha hidratação adequada'}</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>BioPeak Premium Report</strong> | Gerado para: ${userEmail}</p>
            <p>Relatório baseado em análise avançada com IA e dados detalhados de performance</p>
            <p>Activity ID: ${data.activityId} | Source: ${activityData.source?.toUpperCase() || 'UNKNOWN'}</p>
        </div>
    </div>
</body>
</html>
  `.trim();
}