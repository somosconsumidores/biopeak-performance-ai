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

    // Unified activities from last 60 days (prefer all_activities)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sinceDateStr = sixtyDaysAgo.toISOString().split('T')[0];
    
    let activities: any[] = [];
    
    // Try unified all_activities first
    const { data: unifiedData, error: unifiedError } = await supabase
      .from('all_activities')
      .select('activity_date, total_time_minutes, total_distance_meters, average_heart_rate, activity_type, activity_source')
      .eq('user_id', user.id)
      .gte('activity_date', sinceDateStr)
      .order('activity_date', { ascending: false });

    if (!unifiedError && unifiedData && unifiedData.length > 0) {
      console.log(`Using unified all_activities path with ${unifiedData.length} rows`);
      activities = unifiedData.map((a: any) => ({
        activity_date: a.activity_date,
        duration_in_seconds: a.total_time_minutes ? Math.round(a.total_time_minutes * 60) : 0,
        distance_in_meters: a.total_distance_meters || 0,
        average_heart_rate_in_beats_per_minute: a.average_heart_rate || 0,
        vo2_max: null,
        activity_type: a.activity_type || 'unknown',
        source: a.activity_source || 'all_activities',
      }));
    } else {
      console.log('Fallback to legacy sources', unifiedError);
      const [garminResult, stravaResult, stravaGpxResult, polarResult, zeppResult] = await Promise.all([
        // Garmin activities
        supabase
          .from('garmin_activities')
          .select('activity_date, duration_in_seconds, distance_in_meters, average_heart_rate_in_beats_per_minute, vo2_max, activity_type')
          .eq('user_id', user.id)
          .gte('activity_date', sinceDateStr),
        
        // Strava activities
        supabase
          .from('strava_activities')
          .select('start_date, moving_time, distance, average_heartrate, type')
          .eq('user_id', user.id)
          .gte('start_date', sinceDateStr),
        
        // Strava GPX activities
        supabase
          .from('strava_gpx_activities')
          .select('activity_date, duration_in_seconds, distance_in_meters, average_heart_rate, activity_type')
          .eq('user_id', user.id)
          .gte('activity_date', sinceDateStr),
        
        // Polar activities
        supabase
          .from('polar_activities')
          .select('start_time, duration, distance, average_heart_rate_bpm, activity_type')
          .eq('user_id', user.id)
          .gte('start_time', sinceDateStr),
        
        // Zepp GPX activities
        supabase
          .from('zepp_gpx_activities')
          .select('start_time, duration_in_seconds, distance_in_meters, average_heart_rate, activity_type')
          .eq('user_id', user.id)
          .gte('start_time', sinceDateStr)
      ]);

      // Combine all activities into unified format
      if (garminResult.data) {
        activities.push(...garminResult.data.map((a: any) => ({
          activity_date: a.activity_date,
          duration_in_seconds: a.duration_in_seconds,
          distance_in_meters: a.distance_in_meters,
          average_heart_rate_in_beats_per_minute: a.average_heart_rate_in_beats_per_minute,
          vo2_max: a.vo2_max,
          activity_type: a.activity_type,
          source: 'Garmin'
        })));
      }
      
      if (stravaResult.data) {
        activities.push(...stravaResult.data.map((a: any) => ({
          activity_date: a.start_date ? new Date(a.start_date).toISOString().split('T')[0] : null,
          duration_in_seconds: a.moving_time || 0,
          distance_in_meters: a.distance || 0,
          average_heart_rate_in_beats_per_minute: a.average_heartrate || 0,
          vo2_max: null,
          activity_type: a.type || 'unknown',
          source: 'Strava'
        })));
      }
      
      if (stravaGpxResult.data) {
        activities.push(...stravaGpxResult.data.map((a: any) => ({
          activity_date: a.activity_date,
          duration_in_seconds: a.duration_in_seconds,
          distance_in_meters: a.distance_in_meters,
          average_heart_rate_in_beats_per_minute: a.average_heart_rate,
          vo2_max: null,
          activity_type: a.activity_type,
          source: 'Strava GPX'
        })));
      }
      
      if (polarResult.data) {
        activities.push(...polarResult.data.map((a: any) => ({
          activity_date: a.start_time ? new Date(a.start_time).toISOString().split('T')[0] : null,
          duration_in_seconds: a.duration ? parseInt(String(a.duration).replace(/\D/g, '')) * 60 : 0, // Convert duration string to seconds
          distance_in_meters: a.distance || 0,
          average_heart_rate_in_beats_per_minute: a.average_heart_rate_bpm || 0,
          vo2_max: null,
          activity_type: a.activity_type || 'unknown',
          source: 'Polar'
        })));
      }
      
      if (zeppResult.data) {
        activities.push(...zeppResult.data.map((a: any) => ({
          activity_date: a.start_time ? new Date(a.start_time).toISOString().split('T')[0] : null,
          duration_in_seconds: a.duration_in_seconds || 0,
          distance_in_meters: a.distance_in_meters || 0,
          average_heart_rate_in_beats_per_minute: a.average_heart_rate || 0,
          vo2_max: null,
          activity_type: a.activity_type || 'unknown',
          source: 'Zepp'
        })));
      }

      const activitiesError = (garminResult as any).error || (stravaResult as any).error || (stravaGpxResult as any).error || (polarResult as any).error || (zeppResult as any).error;
      if (activitiesError) {
        console.error('Error fetching activities:', activitiesError);
        return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Sort by date (most recent first)
    activities.sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime());

    // VO2 Max average from garmin_vo2max (last 30 days - same logic as dashboard)
    let avgVO2Max: number | null = null;
    let garminUserId: string | null = null;

    const { data: tokenRow } = await supabase
      .from('garmin_tokens')
      .select('garmin_user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenRow?.garmin_user_id) {
      garminUserId = tokenRow.garmin_user_id;
    } else {
      const { data: mapRow } = await supabase
        .from('garmin_user_mapping')
        .select('garmin_user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mapRow?.garmin_user_id) {
        garminUserId = mapRow.garmin_user_id;
      }
    }

    if (garminUserId) {
      // Use last 30 days for consistency with dashboard
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: vo2Rows, error: vo2Err } = await supabase
        .from('garmin_vo2max')
        .select('vo2_max_running, vo2_max_cycling, calendar_date')
        .eq('garmin_user_id', garminUserId)
        .gte('calendar_date', thirtyDaysStr)
        .order('calendar_date', { ascending: false });

      if (!vo2Err && vo2Rows && vo2Rows.length > 0) {
        // Find the first non-null value (same logic as dashboard)
        for (const vo2Record of vo2Rows) {
          const vo2Value = vo2Record.vo2_max_running || vo2Record.vo2_max_cycling;
          if (vo2Value != null) {
            avgVO2Max = Math.round(vo2Value * 10) / 10;
            break;
          }
        }
      }
    }

    // Fallback to activities VO2 max if no garmin_vo2max data (same as dashboard)
    if (!avgVO2Max) {
      const last30Days = activities.filter(act => {
        if (!act.activity_date) return false;
        const actDate = new Date(act.activity_date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return actDate >= thirtyDaysAgo;
      });
      
      const vo2Activities = last30Days.filter(act => act.vo2_max);
      if (vo2Activities.length > 0) {
        avgVO2Max = Math.round((vo2Activities.reduce((sum, act) => sum + act.vo2_max, 0) / vo2Activities.length) * 10) / 10;
      }
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Prepare data summary for AI analysis
    const totalActivities = activities?.length || 0;
    const avgDistance = totalActivities ? (activities.reduce((acc, act) => acc + (act.distance_in_meters || 0), 0) / totalActivities / 1000) : 0;
    const avgDuration = totalActivities ? (activities.reduce((acc, act) => acc + (act.duration_in_seconds || 0), 0) / totalActivities / 60) : 0;
    const avgHeartRate = totalActivities ? (activities.reduce((acc, act) => acc + (act.average_heart_rate_in_beats_per_minute || 0), 0) / totalActivities) : 0;
    
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
        max_completion_tokens: 2000,
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