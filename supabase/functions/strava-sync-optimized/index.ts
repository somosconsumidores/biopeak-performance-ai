import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    
    // Safely parse body - handle empty or invalid JSON
    let body: any = {};
    try {
      const text = await req.text();
      if (text && text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      console.log('[StravaSync] No valid JSON body provided, using empty object');
    }
    
    let userId: string;

    // Check if this is an internal call with user_id in body (from strava-sync-background)
    if (body.user_id && authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) {
      userId = body.user_id;
      console.log(`[StravaSync] Internal call for user: ${userId}`);
    } else {
      // External call - authenticate with JWT
      const { data: user, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user?.user) {
        console.error('Authentication error:', authError);
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = user.user.id;
    }
    console.log(`[StravaSync] Starting optimized sync for user: ${userId}`);

    // Get user's Strava credentials
    const { data: stravaData, error: stravaError } = await supabase
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single();

    if (stravaError || !stravaData) {
      console.error('Strava credentials not found:', stravaError);
      return new Response(
        JSON.stringify({ error: 'Strava credentials not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = stravaData.access_token;

    // Check if token needs refresh
    if (new Date(stravaData.expires_at) <= new Date()) {
      console.log('[StravaSync] Token expired, refreshing...');
      
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Deno.env.get('STRAVA_CLIENT_ID'),
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
          refresh_token: stravaData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        console.error('Token refresh failed');
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Strava token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update tokens in database
      await supabase
        .from('strava_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userId);
    }

    // Get the most recent activity from our database to determine sync point
    const { data: lastActivity } = await supabase
      .from('strava_activities')
      .select('start_date')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(1);

    // Calculate sync period - only last 6 months for initial optimization
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const syncAfter = lastActivity?.start_date 
      ? Math.max(new Date(lastActivity.start_date).getTime() / 1000, sixMonthsAgo.getTime() / 1000)
      : sixMonthsAgo.getTime() / 1000;

    console.log(`[StravaSync] Syncing activities after: ${new Date(syncAfter * 1000).toISOString()}`);

    let page = 1;
    let totalSynced = 0;
    const maxActivities = 200; // Limit to prevent long-running syncs
    const maxPages = 10; // Limit pages for safety
    const startTime = Date.now();
    const maxSyncTime = 30000; // 30 seconds max

    while (page <= maxPages && totalSynced < maxActivities) {
      // Check time limit
      if (Date.now() - startTime > maxSyncTime) {
        console.log('[StravaSync] Time limit reached, stopping sync');
        break;
      }

      console.log(`[StravaSync] Fetching page ${page}...`);
      
      const activitiesResponse = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${Math.floor(syncAfter)}&page=${page}&per_page=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!activitiesResponse.ok) {
        console.error(`Failed to fetch activities page ${page}:`, activitiesResponse.status);
        break;
      }

      const activities = await activitiesResponse.json();
      
      if (!activities || activities.length === 0) {
        console.log('[StravaSync] No more activities to sync');
        break;
      }

      // Process activities in batch - only use columns that exist in the table
      const activitiesToInsert = activities.map((activity: any) => ({
        user_id: userId,
        strava_activity_id: activity.id,
        name: activity.name,
        type: activity.type,
        distance: activity.distance,
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        total_elevation_gain: activity.total_elevation_gain,
        start_date: activity.start_date,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        calories: activity.calories,
      }));

      // Insert activities with upsert to handle duplicates
      const { error: insertError } = await supabase
        .from('strava_activities')
        .upsert(activitiesToInsert, { onConflict: 'user_id, strava_activity_id' });

      if (insertError) {
        console.error(`Error inserting activities from page ${page}:`, insertError);
      } else {
        totalSynced += activities.length;
        console.log(`[StravaSync] Synced ${activities.length} activities from page ${page}, total: ${totalSynced}`);
      }

      page++;
    }

    // Update sync timestamp in strava_tokens (only columns that exist)
    const { error: updateError } = await supabase
      .from('strava_tokens')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating sync status:', updateError);
    }

    const syncDuration = Date.now() - startTime;
    const isPartialSync = totalSynced >= maxActivities || syncDuration >= maxSyncTime || page > maxPages;

    console.log(`[StravaSync] Sync completed. Synced: ${totalSynced} activities in ${syncDuration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        total: totalSynced,
        isIncremental: true,
        isPartial: isPartialSync,
        syncDuration,
        message: isPartialSync 
          ? `Sincronização parcial: ${totalSynced} atividades (últimos 6 meses)`
          : `Sincronização completa: ${totalSynced} atividades`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[StravaSync] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});