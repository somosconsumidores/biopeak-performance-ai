import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[manual-sync-trigger] Function started');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`[manual-sync-trigger] Starting manual sync for user: ${userId}`);

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('garmin_tokens')
      .select('access_token, garmin_user_id, initial_sync_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error(`No Garmin tokens found: ${tokenError?.message}`);
    }

    if (!tokenData.access_token) {
      throw new Error('No access token available');
    }

    console.log(`[manual-sync-trigger] Found tokens for Garmin user: ${tokenData.garmin_user_id}`);

    // Call sync-garmin-activities function directly with manual sync flag
    const syncPayload = {
      userId: tokenData.garmin_user_id,
      userAccessToken: tokenData.access_token,
      manualSync: true,
      webhookUserId: userId // Use our internal user ID
    };

    console.log('[manual-sync-trigger] Calling sync-garmin-activities...');

    const { data: syncResponse, error: syncError } = await supabaseClient.functions.invoke(
      'sync-garmin-activities',
      {
        body: syncPayload,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (syncError) {
      console.error('[manual-sync-trigger] Sync function error:', syncError);
      throw new Error(`Sync failed: ${syncError.message}`);
    }

    console.log('[manual-sync-trigger] Sync response:', syncResponse);

    // Mark initial sync as completed if it wasn't already
    if (!tokenData.initial_sync_completed) {
      const { error: updateError } = await supabaseClient
        .from('garmin_tokens')
        .update({ initial_sync_completed: true })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[manual-sync-trigger] Failed to mark initial sync as completed:', updateError);
      } else {
        console.log('[manual-sync-trigger] Marked initial sync as completed');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Manual sync completed successfully',
        syncResponse 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[manual-sync-trigger] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});