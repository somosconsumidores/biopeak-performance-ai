import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolarActivity {
  id: string;
  upload_time: string;
  polar_user: string;
  transaction_id: number;
  exercise?: {
    id: string;
    upload_time: string;
    polar_user: string;
    device: string;
    device_id: string;
    start_time: string;
    start_time_utc_offset: number;
    duration: string;
    calories: number;
    distance: number;
    heart_rate?: {
      average: number;
      maximum: number;
    };
    training_load?: number;
    sport: string;
    has_route: boolean;
    club_id?: number;
    club_name?: string;
    detailed_sport_info: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, polar_user_id, access_token, webhook_payload } = await req.json();

    if (!user_id || !access_token) {
      throw new Error('User ID and access token are required');
    }

    // Use polar_user_id for API calls, fallback to user_id if not provided
    const apiUserId = polar_user_id || user_id;
    
    console.log('[sync-polar-activities] Starting sync for user:', user_id);
    console.log('[sync-polar-activities] Using Polar user ID for API calls:', apiUserId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Create transaction to get available activities
    const transactionResponse = await fetch(`https://www.polaraccesslink.com/v3/users/${apiUserId}/exercise-transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!transactionResponse.ok) {
      if (transactionResponse.status === 204) {
        console.log('[sync-polar-activities] No activities to sync (204 response)');
        return new Response(
          JSON.stringify({
            success: true,
            synced_activities: 0,
            total_available: 0,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      throw new Error(`Failed to create transaction: ${transactionResponse.statusText}`);
    }

    const transactionData = await transactionResponse.json();
    const transactionId = transactionData['transaction-id'];
    console.log('[sync-polar-activities] Created transaction:', transactionId);

    // Get activities from transaction
    const activitiesResponse = await fetch(`https://www.polaraccesslink.com/v3/users/${apiUserId}/exercise-transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!activitiesResponse.ok) {
      throw new Error(`Failed to fetch activities: ${activitiesResponse.statusText}`);
    }

    const activitiesData = await activitiesResponse.json();
    const activities: string[] = activitiesData['exercises'] || [];

    console.log('[sync-polar-activities] Found', activities.length, 'available activities');

    let syncedCount = 0;

    // Process each activity
    for (const activityUrl of activities) {
      try {
        // Fetch detailed activity data
        const activityResponse = await fetch(activityUrl, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json',
          },
        });

        if (!activityResponse.ok) {
          console.error('[sync-polar-activities] Failed to fetch activity:', activityUrl);
          continue;
        }

        const activityData: PolarActivity = await activityResponse.json();
        
        // Check if activity already exists
        const { data: existingActivity } = await supabase
          .from('polar_activities')
          .select('id')
          .eq('activity_id', activityData.id)
          .eq('user_id', user_id)
          .single();

        if (existingActivity) {
          console.log('[sync-polar-activities] Activity already exists:', activityData.id);
          continue;
        }

        // Insert new activity
        const { error: insertError } = await supabase
          .from('polar_activities')
          .insert({
            user_id: user_id,
            activity_id: activityData.id,
            upload_time: activityData.upload_time,
            polar_user: activityData.polar_user,
            transaction_id: activityData.transaction_id,
            start_time: activityData.exercise?.start_time,
            start_time_utc_offset: activityData.exercise?.start_time_utc_offset,
            duration: activityData.exercise?.duration,
            calories: activityData.exercise?.calories,
            distance: activityData.exercise?.distance,
            training_load: activityData.exercise?.training_load,
            sport: activityData.exercise?.sport,
            has_route: activityData.exercise?.has_route || false,
            club_id: activityData.exercise?.club_id,
            club_name: activityData.exercise?.club_name,
            detailed_sport_info: activityData.exercise?.detailed_sport_info,
            device: activityData.exercise?.device,
            device_id: activityData.exercise?.device_id,
            polar_user_id: parseInt(activityData.polar_user),
          });

        if (insertError) {
          console.error('[sync-polar-activities] Failed to insert activity:', insertError);
        } else {
          syncedCount++;
          console.log('[sync-polar-activities] Synced activity:', activityData.id);
        }

      } catch (activityError) {
        console.error('[sync-polar-activities] Error processing activity:', activityError);
      }
    }

    // Commit transaction to confirm processing
    const commitResponse = await fetch(`https://www.polaraccesslink.com/v3/users/${apiUserId}/exercise-transactions/${transactionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!commitResponse.ok) {
      console.error('[sync-polar-activities] Failed to commit transaction:', commitResponse.statusText);
    }

    console.log('[sync-polar-activities] Sync completed. Synced', syncedCount, 'activities');

    return new Response(
      JSON.stringify({
        success: true,
        synced_activities: syncedCount,
        total_available: activities.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[sync-polar-activities] Error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});