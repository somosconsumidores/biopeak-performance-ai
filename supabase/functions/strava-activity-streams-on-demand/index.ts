import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const requestBody = await req.json();
    const { activity_id } = requestBody;

    if (!activity_id) {
      throw new Error('activity_id is required');
    }

    // Get user from JWT (always required for on-demand calls)
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authorization.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const currentUserId = user.id;

    console.log(`🔄 On-demand processing streams for activity ${activity_id} for user ${currentUserId}`);

    // Get user's Strava token and refresh if needed
    let { data: stravaTokens, error: tokenError } = await supabase
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', currentUserId)
      .single();

    if (tokenError || !stravaTokens) {
      throw new Error('No valid Strava token found');
    }

    let stravaAccessToken = stravaTokens.access_token;

    // Check if token is expired and refresh if needed
    if (stravaTokens.expires_at && new Date(stravaTokens.expires_at) <= new Date()) {
      console.log('🔄 Token expired, attempting refresh...');
      try {
        const refreshResp = await supabase.functions.invoke('strava-token-refresh', {
          body: { 
            user_id: currentUserId,
            refresh_token: stravaTokens.refresh_token 
          },
        });
        if (!refreshResp.error && refreshResp.data?.access_token) {
          stravaAccessToken = refreshResp.data.access_token;
          console.log('✅ Token refreshed successfully');
        }
      } catch (e) {
        console.warn('⚠️ Token refresh failed:', e);
      }
    }

    // Fetch activity streams from Strava API
    const streamKeys = [
      'latlng',
      'heartrate', 
      'velocity_smooth',
      'cadence',
      'watts',
      'distance',
      'time',
      'grade_smooth',
      'temp',
      'moving'
    ].join(',');

    let stravaResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activity_id}/streams?keys=${streamKeys}&key_by_type=true`,
      {
        headers: {
          'Authorization': `Bearer ${stravaAccessToken}`,
        },
      }
    );

    // If unauthorized, try one more token refresh and retry
    if (stravaResponse.status === 401) {
      console.log('🔄 Got 401, trying final token refresh...');
      try {
        const refreshResp = await supabase.functions.invoke('strava-token-refresh', {
          body: { user_id: currentUserId },
        });
        if (!refreshResp.error && refreshResp.data?.access_token) {
          stravaAccessToken = refreshResp.data.access_token;
          stravaResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activity_id}/streams?keys=${streamKeys}&key_by_type=true`,
            {
              headers: {
                'Authorization': `Bearer ${stravaAccessToken}`,
              },
            }
          );
        }
      } catch (e) {
        console.warn('⚠️ Final token refresh attempt failed:', e);
      }
    }

    if (!stravaResponse.ok) {
      const errorText = await stravaResponse.text();
      console.error('❌ Strava API error:', stravaResponse.status, errorText);
      
      if (stravaResponse.status === 404) {
        throw new Error('Atividade não encontrada ou não é pública');
      } else if (stravaResponse.status === 403) {
        throw new Error('Acesso negado à atividade');
      } else if (stravaResponse.status === 401) {
        throw new Error('Token Strava expirado. Reconecte sua conta');
      } else {
        throw new Error(`Erro da API Strava: ${stravaResponse.status}`);
      }
    }

    const streams = await stravaResponse.json();
    console.log('✅ Successfully fetched streams from Strava:', Object.keys(streams));

    // Transform streams into individual time-point records
    const timePoints = [];
    
    // Get the time stream as the base for iteration
    const timeData = streams.time?.data || [];
    const latlngData = streams.latlng?.data || [];
    const heartrateData = streams.heartrate?.data || [];
    const velocityData = streams.velocity_smooth?.data || [];
    const cadenceData = streams.cadence?.data || [];
    const wattsData = streams.watts?.data || [];
    const distanceData = streams.distance?.data || [];
    const gradeData = streams.grade_smooth?.data || [];
    const tempData = streams.temp?.data || [];
    const movingData = streams.moving?.data || [];

    const pointsCount = timeData.length;
    console.log(`📊 Processing ${pointsCount} time points for activity ${activity_id}`);

    // Create individual records for each time point
    for (let i = 0; i < timeData.length; i++) {
      const timePoint = {
        user_id: currentUserId,
        strava_activity_id: parseInt(activity_id),
        time_index: i,
        time_seconds: timeData[i] || null,
        latitude: latlngData[i] ? latlngData[i][0] : null,
        longitude: latlngData[i] ? latlngData[i][1] : null,
        heartrate: heartrateData[i] || null,
        velocity_smooth: velocityData[i] || null,
        cadence: cadenceData[i] || null,
        watts: wattsData[i] || null,
        distance: distanceData[i] || null,
        grade_smooth: gradeData[i] || null,
        temp: tempData[i] || null,
        moving: movingData[i] || null,
      };
      timePoints.push(timePoint);
    }

    // Build chart data directly from streams
    console.log('🏗️ Building chart data from streams...');
    try {
      await supabase.functions.invoke('build-activity-chart-from-strava-streams', {
        body: {
          activity_id: String(activity_id),
          user_id: currentUserId,
          access_token: stravaAccessToken,
          internal_call: true,
          full_precision: false
        },
      });
      console.log('✅ Chart data built successfully');
    } catch (err) {
      console.error('❌ Failed to build chart data:', err);
      throw new Error('Falha ao processar análises da atividade');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed_points: pointsCount,
        activity_id: activity_id,
        message: `Análise gerada com sucesso para ${pointsCount} pontos de dados` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Error in strava-activity-streams-on-demand function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});