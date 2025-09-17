import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Optimized sync with smart pagination and time limits
async function smartStravaSync(serviceRoleClient: any, userId: string, options: any = {}) {
  const {
    maxActivities = 50, // Limit initial sync to 50 activities
    maxTimeMinutes = 2, // Maximum 2 minutes execution time
    background = false // Whether this is a background sync
  } = options;

  console.log(`🚀 [SmartSync] Starting sync for user ${userId}`, { maxActivities, maxTimeMinutes, background });
  
  const startTime = Date.now();
  const maxTimeMs = maxTimeMinutes * 60 * 1000;
  
  try {
    // Get user's Strava tokens
    const { data: tokenData, error: tokenError } = await serviceRoleClient
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at, athlete_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error('No Strava tokens found for user');
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) <= new Date()) {
      console.log('🔄 [SmartSync] Refreshing expired token');
      
      const { data: refreshData, error: refreshError } = await serviceRoleClient.functions.invoke('strava-token-refresh', {
        body: { refresh_token: tokenData.refresh_token, user_id: userId }
      });
      
      if (refreshError || !refreshData?.access_token) {
        throw new Error('Failed to refresh Strava token');
      }
      
      accessToken = refreshData.access_token;
      console.log('✅ [SmartSync] Token refreshed successfully');
    }

    // Get last sync info to determine if this is incremental
    const { data: lastSync } = await serviceRoleClient
      .from('strava_sync_status')
      .select('last_sync_at, total_activities_synced')
      .eq('user_id', userId)
      .maybeSingle();

    const isIncremental = !!lastSync?.last_sync_at;
    const afterDate = isIncremental ? Math.floor(new Date(lastSync.last_sync_at).getTime() / 1000) : undefined;
    
    console.log(`📊 [SmartSync] Sync type: ${isIncremental ? 'incremental' : 'initial'}`, { afterDate });

    // Update status to in_progress
    await serviceRoleClient
      .from('strava_sync_status')
      .upsert({
        user_id: userId,
        sync_status: 'in_progress',
        updated_at: new Date().toISOString()
      });

    // Fetch activities with smart pagination
    let allActivities = [];
    let page = 1;
    const perPage = 30; // Smaller page size for faster responses
    let totalFetched = 0;

    while (totalFetched < maxActivities && (Date.now() - startTime) < maxTimeMs) {
      console.log(`🔍 [SmartSync] Fetching page ${page} (${totalFetched}/${maxActivities} activities)`);
      
      const url = new URL('https://www.strava.com/api/v3/athlete/activities');
      url.searchParams.set('per_page', perPage.toString());
      url.searchParams.set('page', page.toString());
      if (afterDate) {
        url.searchParams.set('after', afterDate.toString());
      }

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new Error(`Strava API error: ${response.status}`);
      }

      const activities = await response.json();
      
      if (!activities || activities.length === 0) {
        console.log('📝 [SmartSync] No more activities found');
        break;
      }

      allActivities.push(...activities);
      totalFetched += activities.length;
      page++;

      // Check time limit
      if ((Date.now() - startTime) >= maxTimeMs * 0.8) { // Use 80% of time limit
        console.log('⏰ [SmartSync] Approaching time limit, stopping fetch');
        break;
      }
    }

    console.log(`📊 [SmartSync] Fetched ${allActivities.length} activities in ${Math.round((Date.now() - startTime) / 1000)}s`);

    // Process activities quickly - just store basic data, detailed processing later
    let processed = 0;
    let lastActivityDate = null;

    for (const activity of allActivities) {
      // Check time limit periodically
      if ((Date.now() - startTime) >= maxTimeMs) {
        console.log('⏰ [SmartSync] Time limit reached, stopping processing');
        break;
      }

      try {
        // Convert Strava activity to our format
        const activityData = {
          user_id: userId,
          strava_activity_id: activity.id,
          name: activity.name,
          activity_type: activity.sport_type || activity.type,
          activity_source: 'STRAVA',
          start_date: activity.start_date,
          duration: activity.elapsed_time,
          distance: activity.distance,
          elevation_gain: activity.total_elevation_gain,
          calories: activity.kilojoules ? Math.round(activity.kilojoules * 0.239) : null,
          average_heart_rate: activity.average_heartrate,
          max_heart_rate: activity.max_heartrate,
          average_speed: activity.average_speed,
          max_speed: activity.max_speed,
          average_cadence: activity.average_cadence,
          average_power: activity.average_watts,
          max_power: activity.max_watts,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Upsert activity (insert or update if exists)
        const { error: insertError } = await serviceRoleClient
          .from('strava_activities')
          .upsert(activityData, { 
            onConflict: 'user_id,strava_activity_id',
            ignoreDuplicates: false 
          });

        if (!insertError) {
          processed++;
          lastActivityDate = new Date(activity.start_date);
          
          // For initial sync, prioritize recent activities for analysis
          if (!isIncremental && processed <= 10) {
            console.log(`🎯 [SmartSync] High-priority activity: ${activity.name}`);
            // Could trigger detailed analysis for recent activities here
          }
        } else {
          console.warn(`⚠️ [SmartSync] Failed to store activity ${activity.id}:`, insertError);
        }
      } catch (activityError) {
        console.warn(`⚠️ [SmartSync] Error processing activity ${activity.id}:`, activityError);
      }
    }

    // Update sync status
    const totalSyncedNow = (lastSync?.total_activities_synced || 0) + processed;
    
    await serviceRoleClient
      .from('strava_sync_status')
      .upsert({
        user_id: userId,
        sync_status: 'completed',
        last_sync_at: new Date().toISOString(),
        last_activity_date: lastActivityDate?.toISOString(),
        total_activities_synced: totalSyncedNow,
        updated_at: new Date().toISOString(),
        error_message: null
      });

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ [SmartSync] Completed successfully: ${processed} activities in ${duration}s`);

    return {
      success: true,
      synced: processed,
      total: allActivities.length,
      isIncremental,
      duration,
      message: isIncremental 
        ? `${processed} novas atividades sincronizadas`
        : `${processed} atividades iniciais sincronizadas`
    };

  } catch (error) {
    console.error('❌ [SmartSync] Error:', error);
    
    // Update status to error
    await serviceRoleClient
      .from('strava_sync_status')
      .upsert({
        user_id: userId,
        sync_status: 'error',
        error_message: error.message,
        updated_at: new Date().toISOString()
      });

    return {
      success: false,
      error: error.message,
      duration: Math.round((Date.now() - startTime) / 1000)
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    console.log(`🔵 [SmartSync] Request from user: ${user.id}`);

    // Parse request body for options
    const requestBody = await req.json().catch(() => ({}));
    const { maxActivities, background, maxTimeMinutes } = requestBody;

    // Perform smart sync
    const result = await smartStravaSync(serviceRoleClient, user.id, {
      maxActivities: maxActivities || (background ? 100 : 50),
      maxTimeMinutes: maxTimeMinutes || 2,
      background: background || false
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400
    });

  } catch (error) {
    console.error('❌ [SmartSync] Handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});