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
    const { activity_id, user_id, access_token, internal_call } = requestBody;

    let currentUserId;
    let stravaAccessToken;

    // Handle internal calls from other edge functions
    if (internal_call && user_id && access_token) {
      currentUserId = user_id;
      stravaAccessToken = access_token;
      console.log('Processing internal call for user:', currentUserId);
    } else {
      // Handle regular authenticated calls
      const authorization = req.headers.get('Authorization');
      if (!authorization) {
        throw new Error('No authorization header');
      }

      // Get user from JWT
      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authorization.replace('Bearer ', '')
      );
      
      if (userError || !user) {
        throw new Error('Invalid user token');
      }

      currentUserId = user.id;

      // Get user's Strava token
      const { data: stravaTokens, error: tokenError } = await supabase
        .from('strava_tokens')
        .select('access_token')
        .eq('user_id', currentUserId)
        .eq('is_active', true)
        .single();

      if (tokenError || !stravaTokens) {
        throw new Error('No valid Strava token found');
      }

      stravaAccessToken = stravaTokens.access_token;
    }
    
    if (!activity_id) {
      throw new Error('activity_id is required');
    }

    console.log(`Fetching streams for activity ${activity_id} for user ${currentUserId}`);

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

    const stravaResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activity_id}/streams?keys=${streamKeys}&key_by_type=true`,
      {
        headers: {
          'Authorization': `Bearer ${stravaAccessToken}`,
        },
      }
    );

    if (!stravaResponse.ok) {
      const errorText = await stravaResponse.text();
      console.error('Strava API error:', stravaResponse.status, errorText);
      throw new Error(`Strava API error: ${stravaResponse.status}`);
    }

    const streams = await stravaResponse.json();
    console.log('Successfully fetched streams from Strava:', Object.keys(streams));

    // Save streams to database
    const { data: existingRecord } = await supabase
      .from('strava_activity_details')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('strava_activity_id', activity_id)
      .single();

    const streamData = {
      user_id: currentUserId,
      strava_activity_id: activity_id,
      latlng: streams.latlng || null,
      heartrate: streams.heartrate || null,
      velocity_smooth: streams.velocity_smooth || null,
      cadence: streams.cadence || null,
      watts: streams.watts || null,
      distance: streams.distance || null,
      time: streams.time || null,
      grade_smooth: streams.grade_smooth || null,
      temp: streams.temp || null,
      moving: streams.moving || null,
    };

    let result;
    if (existingRecord) {
      // Update existing record
      const { data, error } = await supabase
        .from('strava_activity_details')
        .update(streamData)
        .eq('id', existingRecord.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('strava_activity_details')
        .insert(streamData)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    console.log('Successfully saved streams to database');

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        message: 'Activity streams fetched and saved successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in strava-activity-streams function:', error);
    
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