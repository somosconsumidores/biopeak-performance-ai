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
    console.log('[trigger-initial-sync] Function started');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[trigger-initial-sync] Supabase client created');

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[trigger-initial-sync] Extracting user from token...');
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError) {
      console.error('[trigger-initial-sync] Error getting user:', userError);
      throw new Error(`Auth error: ${userError.message}`);
    }

    if (!user) {
      throw new Error('Not authenticated');
    }

    console.log(`[trigger-initial-sync] Starting initial sync for user: ${user.id}`);

    // Check if user already has initial sync completed
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('garmin_tokens')
      .select('initial_sync_completed, garmin_user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('[trigger-initial-sync] Token data:', { tokenData, tokenError });

    if (tokenError) {
      throw new Error(`Failed to get token data: ${tokenError.message}`);
    }

    if (!tokenData) {
      throw new Error('No Garmin tokens found for user');
    }

    if (tokenData.initial_sync_completed) {
      console.log(`User ${user.id} already has initial sync completed`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Initial sync already completed',
          skipped: true 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    if (!tokenData.garmin_user_id) {
      throw new Error('Garmin user ID not found');
    }

    console.log(`Triggering initial sync for Garmin user: ${tokenData.garmin_user_id}`);

    // Create a synthetic webhook payload for initial sync
    const webhookPayload = {
      userId: tokenData.garmin_user_id,
      userAccessToken: user.id, // We'll use our user ID as identifier
      summaryId: `initial-sync-${Date.now()}`,
      activitySummary: {
        startTimeInSeconds: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // 30 days ago
        activityType: "RUNNING", // Default type for initial sync
        summaryId: `initial-sync-${Date.now()}`
      },
      metricDescriptors: [],
      activityDetails: [],
      initialSync: true // Special flag to indicate this is initial sync
    };

    // Call the sync-garmin-activities function with the synthetic payload
    const { data: syncResponse, error: syncError } = await supabaseClient.functions.invoke(
      'sync-garmin-activities',
      {
        body: webhookPayload,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        }
      }
    );

    if (syncError) {
      console.error('Sync function error:', syncError);
      throw new Error(`Sync failed: ${syncError.message}`);
    }

    console.log('Sync response:', syncResponse);

    // Mark initial sync as completed
    const { error: updateError } = await supabaseClient
      .from('garmin_tokens')
      .update({ initial_sync_completed: true })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to mark initial sync as completed:', updateError);
      // Don't throw here, sync was successful
    }

    console.log(`Initial sync completed for user: ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Initial sync triggered successfully',
        syncResponse 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in trigger-initial-sync:', error);
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