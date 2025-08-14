import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user activities from last 60 days - from all sources
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    // Fetch from all activity sources
    const [garminResult, stravaResult, stravaGpxResult, polarResult, zeppResult] = await Promise.all([
      // Garmin activities
      supabase
        .from('garmin_activities')
        .select('activity_date, duration_in_seconds, distance_in_meters, average_heart_rate_in_beats_per_minute, vo2_max, activity_type')
        .eq('user_id', user.id)
        .gte('activity_date', sixtyDaysAgo.toISOString().split('T')[0]),
      
      // Strava activities
      supabase
        .from('strava_activities')
        .select('start_date, moving_time, distance, average_heartrate, type')
        .eq('user_id', user.id)
        .gte('start_date', sixtyDaysAgo.toISOString().split('T')[0]),
      
      // Strava GPX activities
      supabase
        .from('strava_gpx_activities')
        .select('activity_date, duration_in_seconds, distance_in_meters, average_heart_rate, activity_type')
        .eq('user_id', user.id)
        .gte('activity_date', sixtyDaysAgo.toISOString().split('T')[0]),
      
      // Polar activities
      supabase
        .from('polar_activities')
        .select('activity_date, duration_in_seconds, distance_in_meters, average_heart_rate, activity_type')
        .eq('user_id', user.id)
        .gte('activity_date', sixtyDaysAgo.toISOString().split('T')[0]),
      
      // Zepp GPX activities
      supabase
        .from('zepp_gpx_activities')
        .select('activity_date, duration_in_seconds, distance_in_meters, average_heart_rate, activity_type')
        .eq('user_id', user.id)
        .gte('activity_date', sixtyDaysAgo.toISOString().split('T')[0])
    ]);

    // Combine all activities into unified format
    const activities = [];
    
    // Add Garmin activities
    if (garminResult.data) {
      activities.push(...garminResult.data.map(a => ({
        activity_date: a.activity_date,
        duration_in_seconds: a.duration_in_seconds,
        distance_in_meters: a.distance_in_meters,
        average_heart_rate_in_beats_per_minute: a.average_heart_rate_in_beats_per_minute,
        vo2_max: a.vo2_max,
        activity_type: a.activity_type,
        source: 'Garmin'
      })));
    }
    
    // Add Strava activities (convert units)
    if (stravaResult.data) {
      activities.push(...stravaResult.data.map(a => ({
        activity_date: a.start_date.split('T')[0], // Convert timestamp to date
        duration_in_seconds: a.moving_time,
        distance_in_meters: a.distance,
        average_heart_rate_in_beats_per_minute: a.average_heartrate,
        vo2_max: null,
        activity_type: a.type,
        source: 'Strava'
      })));
    }
    
    // Add Strava GPX activities
    if (stravaGpxResult.data) {
      activities.push(...stravaGpxResult.data.map(a => ({
        activity_date: a.activity_date,
        duration_in_seconds: a.duration_in_seconds,
        distance_in_meters: a.distance_in_meters,
        average_heart_rate_in_beats_per_minute: a.average_heart_rate,
        vo2_max: null,
        activity_type: a.activity_type,
        source: 'Strava GPX'
      })));
    }
    
    // Add Polar activities
    if (polarResult.data) {
      activities.push(...polarResult.data.map(a => ({
        activity_date: a.activity_date,
        duration_in_seconds: a.duration_in_seconds,
        distance_in_meters: a.distance_in_meters,
        average_heart_rate_in_beats_per_minute: a.average_heart_rate,
        vo2_max: null,
        activity_type: a.activity_type,
        source: 'Polar'
      })));
    }
    
    // Add Zepp GPX activities
    if (zeppResult.data) {
      activities.push(...zeppResult.data.map(a => ({
        activity_date: a.activity_date,
        duration_in_seconds: a.duration_in_seconds,
        distance_in_meters: a.distance_in_meters,
        average_heart_rate_in_beats_per_minute: a.average_heart_rate,
        vo2_max: null,
        activity_type: a.activity_type,
        source: 'Zepp'
      })));
    }

    // Sort by date (most recent first)
    activities.sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime());

    const activitiesError = garminResult.error || stravaResult.error || stravaGpxResult.error || polarResult.error || zeppResult.error;

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Prepare data summary for AI analysis
    const totalActivities = activities?.length || 0;
    const avgDistance = activities?.reduce((acc, act) => acc + (act.distance_in_meters || 0), 0) / totalActivities / 1000;
    const avgDuration = activities?.reduce((acc, act) => acc + (act.duration_in_seconds || 0), 0) / totalActivities / 60;
    const avgHeartRate = activities?.reduce((acc, act) => acc + (act.average_heart_rate_in_beats_per_minute || 0), 0) / totalActivities;
    const avgVO2Max = activities?.filter(act => act.vo2_max).reduce((acc, act) => acc + (act.vo2_max || 0), 0) / activities?.filter(act => act.vo2_max).length;
    
    const activityTypes = activities?.reduce((acc, act) => {
      acc[act.activity_type || 'unknown'] = (acc[act.activity_type || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const lastWeekActivities = activities?.filter(act => {
      const actDate = new Date(act.activity_date || '');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return actDate >= weekAgo;
    });

    const dataContext = {
      totalActivities,
      avgDistance: Math.round(avgDistance * 10) / 10,
      avgDuration: Math.round(avgDuration),
      avgHeartRate: Math.round(avgHeartRate),
      avgVO2Max: Math.round((avgVO2Max || 0) * 10) / 10,
      activityTypes,
      lastWeekCount: lastWeekActivities?.length || 0,
      userAge: profile?.birth_date ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear() : null,
      userWeight: profile?.weight_kg,
      userHeight: profile?.height_cm,
      recentTrend: activities?.slice(0, 7).length > activities?.slice(7, 14).length ? 'increasing' : 'decreasing'
    };

    if (!openAIApiKey) {
      // Return mock data if no OpenAI key
      console.log('No OpenAI key, returning enhanced mock data');
      return new Response(JSON.stringify({
        weeklyInsights: [
          {
            title: `${dataContext.lastWeekCount} atividades esta semana`,
            description: `Baseado nos seus dados reais dos últimos 60 dias`,
            change: dataContext.recentTrend === 'increasing' ? '+15%' : '-8%',
            isPositive: dataContext.recentTrend === 'increasing'
          }
        ],
        personalizedMetrics: [
          {
            label: 'VO₂ Max Médio',
            value: dataContext.avgVO2Max || 45,
            unit: 'ml/kg/min',
            change: '+2.1',
            isPositive: true
          },
          {
            label: 'Frequência Cardíaca Média',
            value: Math.round(dataContext.avgHeartRate) || 150,
            unit: 'bpm',
            change: '-3',
            isPositive: true
          }
        ],
        zoneEffectiveness: [
          { zone: 'Zona 1', percentage: 25, color: 'bg-blue-500' },
          { zone: 'Zona 2', percentage: 40, color: 'bg-green-500' },
          { zone: 'Zona 3', percentage: 20, color: 'bg-yellow-500' },
          { zone: 'Zona 4', percentage: 10, color: 'bg-orange-500' },
          { zone: 'Zona 5', percentage: 5, color: 'bg-red-500' }
        ],
        weeklyGoals: [
          {
            title: 'Meta de Distância',
            target: Math.round(dataContext.avgDistance * 7),
            current: Math.round(dataContext.avgDistance * dataContext.lastWeekCount),
            unit: 'km'
          }
        ],
        aiRecommendations: [
          {
            title: 'Recomendação Baseada em Dados',
            description: `Com base em ${totalActivities} atividades analisadas, considere manter a consistência atual.`,
            priority: 'high'
          }
        ],
        performancePredictions: [
          {
            metric: 'VO₂ Max Projetado',
            currentValue: dataContext.avgVO2Max || 45,
            predictedValue: (dataContext.avgVO2Max || 45) + 2,
            timeframe: '3 meses',
            confidence: 75
          }
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate AI-powered insights
    const prompt = `Analise os dados de treino de um atleta e gere insights personalizados em português brasileiro.

Dados do atleta:
- Total de atividades (60 dias): ${totalActivities}
- Distância média: ${dataContext.avgDistance}km
- Duração média: ${dataContext.avgDuration} minutos
- FC média: ${avgHeartRate} bpm
- VO₂ Max médio: ${avgVO2Max || 'N/A'}
- Atividades por tipo: ${JSON.stringify(activityTypes)}
- Atividades última semana: ${dataContext.lastWeekCount}
- Tendência: ${dataContext.recentTrend}
- Idade: ${dataContext.userAge || 'N/A'}
- Peso: ${dataContext.userWeight || 'N/A'}kg

Gere um JSON com exatamente esta estrutura:
{
  "weeklyInsights": [
    {"title": "string", "description": "string", "change": "string", "isPositive": boolean}
  ],
  "personalizedMetrics": [
    {"label": "string", "value": number, "unit": "string", "change": "string", "isPositive": boolean}
  ],
  "zoneEffectiveness": [
    {"zone": "string", "percentage": number, "color": "string"}
  ],
  "weeklyGoals": [
    {"title": "string", "target": number, "current": number, "unit": "string"}
  ],
  "aiRecommendations": [
    {"title": "string", "description": "string", "priority": "high|medium|low"}
  ],
  "performancePredictions": [
    {"metric": "string", "currentValue": number, "predictedValue": number, "timeframe": "string", "confidence": number}
  ]
}

IMPORTANTE: 
- Retorne APENAS o JSON, sem texto adicional
- Use dados realistas baseados no contexto fornecido
- Seja específico e prático nas recomendações
- Para cores das zonas use: bg-blue-500, bg-green-500, bg-yellow-500, bg-orange-500, bg-red-500`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'Você é um especialista em análise de dados esportivos. Retorne apenas JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const aiData = await response.json();
    const insights = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-insights function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});