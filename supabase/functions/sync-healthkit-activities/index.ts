import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthKitActivity {
  healthkit_uuid: string;
  activity_type: string;
  start_time: string;
  end_time: string;
  duration_seconds?: number;
  distance_meters?: number;
  active_calories?: number;
  total_calories?: number;
  average_heart_rate?: number;
  max_heart_rate?: number;
  steps?: number;
  elevation_gain_meters?: number;
  elevation_loss_meters?: number;
  source_name?: string;
  device_name?: string;
  raw_data?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { activities } = await req.json() as { activities: HealthKitActivity[] };

    if (!activities || !Array.isArray(activities)) {
      return new Response(
        JSON.stringify({ error: 'Invalid activities data' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[sync-healthkit-activities] Processing ${activities.length} activities for user ${user.id}`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process activities in batches
    const batchSize = 10;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      for (const activity of batch) {
        try {
          // Calculate derived fields
          const startTime = new Date(activity.start_time);
          const endTime = new Date(activity.end_time);
          const activityDate = startTime.toISOString().split('T')[0];
          
          // Calculate pace if distance and duration are available
          let paceMinPerKm = null;
          if (activity.distance_meters && activity.duration_seconds) {
            const distanceKm = activity.distance_meters / 1000;
            const durationMinutes = activity.duration_seconds / 60;
            paceMinPerKm = durationMinutes / distanceKm;
          }

          const activityData = {
            user_id: user.id,
            healthkit_uuid: activity.healthkit_uuid,
            activity_type: activity.activity_type,
            start_time: activity.start_time,
            end_time: activity.end_time,
            duration_seconds: activity.duration_seconds,
            distance_meters: activity.distance_meters,
            active_calories: activity.active_calories,
            total_calories: activity.total_calories,
            average_heart_rate: activity.average_heart_rate,
            max_heart_rate: activity.max_heart_rate,
            steps: activity.steps,
            elevation_gain_meters: activity.elevation_gain_meters,
            elevation_loss_meters: activity.elevation_loss_meters,
            pace_min_per_km: paceMinPerKm,
            activity_date: activityDate,
            source_name: activity.source_name || 'HealthKit',
            device_name: activity.device_name || 'Apple Watch',
            raw_data: activity.raw_data || activity,
          };

          // Insert or update activity
          const { error: insertError } = await supabase
            .from('healthkit_activities')
            .upsert(activityData, {
              onConflict: 'user_id, healthkit_uuid'
            });

          if (insertError) {
            console.error('[sync-healthkit-activities] Insert error:', insertError);
            errors.push(`Activity ${activity.healthkit_uuid}: ${insertError.message}`);
            errorCount++;
          } else {
            processedCount++;
            console.log(`[sync-healthkit-activities] Processed activity ${activity.healthkit_uuid}`);
          }
        } catch (error) {
          console.error('[sync-healthkit-activities] Processing error:', error);
          errors.push(`Activity ${activity.healthkit_uuid}: ${error.message}`);
          errorCount++;
        }
      }
    }

    // Update sync status
    const syncData = {
      user_id: user.id,
      sync_status: errorCount > 0 ? 'completed_with_errors' : 'completed',
      last_sync_at: new Date().toISOString(),
      activities_synced: processedCount,
      error_message: errors.length > 0 ? errors.join('; ') : null
    };

    const { error: syncError } = await supabase
      .from('healthkit_sync_status')
      .upsert(syncData, {
        onConflict: 'user_id'
      });

    if (syncError) {
      console.error('[sync-healthkit-activities] Sync status update error:', syncError);
    }

    const result = {
      success: true,
      processed: processedCount,
      total: activities.length,
      errors: errorCount,
      message: `Processadas ${processedCount} de ${activities.length} atividades`
    };

    console.log('[sync-healthkit-activities] Sync completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[sync-healthkit-activities] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});