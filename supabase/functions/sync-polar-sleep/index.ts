import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[sync-polar-sleep] Starting sleep data sync');
    
    const { user_id } = await req.json();
    
    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`[sync-polar-sleep] Syncing sleep data for user: ${user_id}`);

    // Get user's Polar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('polar_tokens')
      .select('access_token, polar_user_id')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      console.error('[sync-polar-sleep] Token error:', tokenError);
      throw new Error('Polar token not found or inactive');
    }

    const { access_token, polar_user_id } = tokenData;

    if (!access_token || !polar_user_id) {
      throw new Error('Invalid Polar token data');
    }

    console.log(`[sync-polar-sleep] Found token for polar_user_id: ${polar_user_id}`);

    // Calculate date range (28 days back from today)
    const today = new Date();
    const fromDate = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    
    const toDateStr = today.toISOString().slice(0, 10);
    const fromDateStr = fromDate.toISOString().slice(0, 10);

    console.log(`[sync-polar-sleep] Fetching sleep data from ${fromDateStr} to ${toDateStr}`);

    // Fetch sleep data from Polar API
    const polarUrl = `https://www.polaraccesslink.com/v3/users/${polar_user_id}/nights?from=${fromDateStr}&to=${toDateStr}`;
    
    const polarResponse = await fetch(polarUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!polarResponse.ok) {
      const errorText = await polarResponse.text();
      console.error('[sync-polar-sleep] Polar API error:', errorText);
      throw new Error(`Polar API error: ${polarResponse.status} - ${errorText}`);
    }

    const nights = await polarResponse.json();
    console.log(`[sync-polar-sleep] Received ${nights.length} nights from Polar`);

    // Store sleep data in database
    let syncedCount = 0;
    let errors = 0;

    for (const night of nights) {
      try {
        const { error: upsertError } = await supabase
          .from('polar_sleep')
          .upsert({
            user_id,
            polar_user_id,
            date: night.date,
            sleep_score: night.sleep_score || null,
            sleep_charge: night.sleep_charge || null,
            sleep_start_time: night.sleep_start_time || null,
            sleep_end_time: night.sleep_end_time || null,
            total_sleep: night.total_sleep || null,
            sleep_goal: night.sleep_goal || null,
            sleep_deficit: night.sleep_deficit || null,
            sleep_efficiency: night.sleep_efficiency || null,
            synced_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id,date'
          });

        if (upsertError) {
          console.error(`[sync-polar-sleep] Error upserting night ${night.date}:`, upsertError);
          errors++;
        } else {
          syncedCount++;
          console.log(`[sync-polar-sleep] Successfully synced night: ${night.date}`);
        }
      } catch (error) {
        console.error(`[sync-polar-sleep] Error processing night ${night.date}:`, error);
        errors++;
      }
    }

    // Log sync control entry
    const { error: syncControlError } = await supabase
      .from('polar_sync_control')
      .insert({
        user_id,
        sync_type: 'sleep',
        triggered_by: 'manual',
        status: 'completed'
      });

    if (syncControlError) {
      console.error('[sync-polar-sleep] Error logging sync control:', syncControlError);
    }

    console.log(`[sync-polar-sleep] Sync completed: ${syncedCount} nights synced, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      synced_nights: syncedCount,
      total_nights: nights.length,
      errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[sync-polar-sleep] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});