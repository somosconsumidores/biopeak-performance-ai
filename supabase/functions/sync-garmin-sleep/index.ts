import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";
import { GarminTokenManager } from "../_shared/garmin-token-manager.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GarminSleepSummary {
  summaryId: string;
  calendarDate: string;
  sleepTimeInSeconds?: number;
  sleepQualityTypeName?: string;
  deepSleepDurationInSeconds?: number;
  lightSleepDurationInSeconds?: number;
  remSleepDurationInSeconds?: number;
  awakeDurationInSeconds?: number;
  sleepStartTimeInSeconds?: number;
  sleepEndTimeInSeconds?: number;
  sleepStartTimeOffsetInSeconds?: number;
  sleepEndTimeOffsetInSeconds?: number;
  unmeasurableSleepInSeconds?: number;
  awakeningCount?: number;
  avgSleepStress?: number;
  ageGroup?: string;
  sleepScore?: number;
  sleepScoreFeedback?: string;
  sleepScoreInsight?: string;
}

interface SyncResult {
  success: boolean;
  summariesProcessed: number;
  summariesAdded: number;
  summariesUpdated: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to check for webhook triggers and admin overrides
    let isWebhookTriggered = false;
    let adminOverride = false;
    let callbackUrl = null;
    let bodyPayload = null;

    try {
      const body = await req.text();
      if (body) {
        bodyPayload = JSON.parse(body);
        isWebhookTriggered = bodyPayload.triggered_by_webhook === true;
        adminOverride = bodyPayload.admin_override === true;
        callbackUrl = bodyPayload.callback_url;
      }
    } catch (error) {
      console.log('[sync-garmin-sleep] No valid request body found, checking headers...');
      // Check if this is a webhook call by examining headers
      const userAgent = req.headers.get('user-agent') || '';
      isWebhookTriggered = userAgent.includes('Garmin Health API') || req.headers.get('x-webhook-source') === 'garmin';
    }

    // Reject non-webhook calls unless admin override is provided
    if (!isWebhookTriggered && !adminOverride) {
      return new Response(JSON.stringify({
        error: 'Sync rejected: Only webhook-triggered syncs are allowed',
        message: 'To prevent Garmin API violations, this endpoint only accepts webhook-triggered requests',
        timestamp: new Date().toISOString()
      }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Authenticate user or service role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    
    let user;
    let userId;
    
    // Check if it's a service role call with user_id in body
    if (token === supabaseServiceKey) {
      // Service role call - get user_id from body payload
      userId = bodyPayload?.user_id;
      
      if (!userId) {
        throw new Error('Service role calls must include user_id in body');
      }
      
      // Create a mock user object for service role calls
      user = { id: userId };
    } else {
      // Regular user token
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !authUser) {
        throw new Error('Authentication failed');
      }
      
      user = authUser;
      userId = user.id;
    }

    // Check rate limiting to prevent excessive sync requests
    // Increased limit for sleep data: 15 syncs per hour (vs 5 for activities)
    // Sleep webhooks can arrive multiple times for the same period
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentSyncs } = await supabase
      .from('garmin_sync_control')
      .select('id')
      .eq('user_id', userId)
      .eq('sync_type', 'sleep')
      .gte('created_at', oneHourAgo);

    const rateLimit = isWebhookTriggered ? 15 : 10; // Higher limit for webhooks vs manual syncs
    
    if (recentSyncs && recentSyncs.length >= rateLimit) {
      console.log(`[sync-garmin-sleep] Rate limit hit: ${recentSyncs.length}/${rateLimit} syncs in last hour for user ${userId}`);
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many sync requests in the last hour (${recentSyncs.length}/${rateLimit})`,
        retryAfter: 3600 // Retry after 1 hour
      }), { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '3600'
        }
      });
    }

    // Log sync attempt
    const { data: syncControl } = await supabase
      .from('garmin_sync_control')
      .insert({
        user_id: userId,
        sync_type: 'sleep',
        triggered_by: isWebhookTriggered ? 'webhook' : 'admin_override',
        callback_url: callbackUrl,
        status: 'pending'
      })
      .select()
      .single();

    console.log(`[sync-garmin-sleep] Starting sleep sync for user ${userId}`);

    // Get Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (tokenError || !tokenData || tokenData.length === 0) {
      throw new Error('No active Garmin tokens found');
    }

    const garminToken = tokenData[0];

    // Refresh token if needed
    const tokenManager = new GarminTokenManager(supabaseUrl, supabaseServiceKey);
    const validAccessToken = await tokenManager.getValidAccessToken(userId);

    if (!validAccessToken) {
      throw new Error('Failed to get valid access token');
    }

    // Determine time range for sleep data
    let startDate: string, endDate: string;
    let sleepSummaries: GarminSleepSummary[] = [];
    
    // Check if we have webhook payload data
    if (bodyPayload?.webhook_payload && bodyPayload.webhook_payload.summaryId) {
      console.log(`[sync-garmin-sleep] Using webhook payload data instead of API call`);
      
      // Convert webhook payload to our GarminSleepSummary format
      const webhookData = bodyPayload.webhook_payload;
      const sleepSummary: GarminSleepSummary = {
        summaryId: webhookData.summaryId,
        calendarDate: webhookData.calendarDate,
        sleepTimeInSeconds: webhookData.durationInSeconds,
        deepSleepDurationInSeconds: webhookData.deepSleepDurationInSeconds,
        lightSleepDurationInSeconds: webhookData.lightSleepDurationInSeconds,
        remSleepDurationInSeconds: webhookData.remSleepInSeconds,
        awakeDurationInSeconds: webhookData.awakeDurationInSeconds,
        sleepStartTimeInSeconds: webhookData.startTimeInSeconds,
        sleepStartTimeOffsetInSeconds: webhookData.startTimeOffsetInSeconds,
        unmeasurableSleepInSeconds: webhookData.unmeasurableSleepInSeconds,
        sleepScore: webhookData.overallSleepScore?.value,
        sleepScoreFeedback: webhookData.sleepScores ? JSON.stringify(webhookData.sleepScores) : null,
        sleepScoreInsight: webhookData.sleepScores ? JSON.stringify(webhookData.sleepScores) : null
      };
      
      sleepSummaries = [sleepSummary];
      console.log(`[sync-garmin-sleep] Converted webhook payload to sleep summary:`, JSON.stringify(sleepSummary, null, 2));
    } else {
      // Original API call logic
      if (callbackUrl) {
        // For webhook calls, get last 7 days to ensure we don't miss any data
        const end = new Date();
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      } else {
        // For manual syncs, get last 30 days
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      }

      // Construct Garmin API URL
      const garminUrl = new URL('https://apis.garmin.com/wellness-api/rest/sleeps');
      garminUrl.searchParams.append('uploadStartTimeInSeconds', Math.floor(new Date(startDate).getTime() / 1000).toString());
      garminUrl.searchParams.append('uploadEndTimeInSeconds', Math.floor(new Date(endDate).getTime() / 1000).toString());

      console.log(`[sync-garmin-sleep] Fetching sleep data from ${garminUrl.toString()}`);

      // Call Garmin API
      const garminResponse = await fetch(garminUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${validAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!garminResponse.ok) {
        const errorText = await garminResponse.text();
        throw new Error(`Garmin API error: ${garminResponse.status} - ${errorText}`);
      }

      const garminData = await garminResponse.json();
      sleepSummaries = garminData.sleepSummaries || [];
      console.log(`[sync-garmin-sleep] Sleep summaries data:`, JSON.stringify(sleepSummaries.slice(0, 2), null, 2));
    }

    console.log(`[sync-garmin-sleep] Received ${sleepSummaries.length} sleep summaries to process`);
    
    let summariesAdded = 0;
    let summariesUpdated = 0;

    // Process each sleep summary
    for (const summary of sleepSummaries) {
      try {
        const sleepData = {
          user_id: userId,
          summary_id: summary.summaryId,
          calendar_date: summary.calendarDate,
          sleep_time_in_seconds: summary.sleepTimeInSeconds || null,
          sleep_quality_type_name: summary.sleepQualityTypeName || null,
          deep_sleep_duration_in_seconds: summary.deepSleepDurationInSeconds || null,
          light_sleep_duration_in_seconds: summary.lightSleepDurationInSeconds || null,
          rem_sleep_duration_in_seconds: summary.remSleepDurationInSeconds || null,
          awake_duration_in_seconds: summary.awakeDurationInSeconds || null,
          sleep_start_time_in_seconds: summary.sleepStartTimeInSeconds || null,
          sleep_end_time_in_seconds: summary.sleepEndTimeInSeconds || null,
          sleep_start_time_offset_in_seconds: summary.sleepStartTimeOffsetInSeconds || null,
          sleep_end_time_offset_in_seconds: summary.sleepEndTimeOffsetInSeconds || null,
          unmeasurable_sleep_in_seconds: summary.unmeasurableSleepInSeconds || null,
          awakening_count: summary.awakeningCount || null,
          avg_sleep_stress: summary.avgSleepStress || null,
          age_group: summary.ageGroup || null,
          sleep_score: summary.sleepScore || null,
          sleep_score_feedback: summary.sleepScoreFeedback || null,
          sleep_score_insight: summary.sleepScoreInsight || null,
          synced_at: new Date().toISOString()
        };

        // Upsert sleep summary
        const { error: upsertError } = await supabase
          .from('garmin_sleep_summaries')
          .upsert(sleepData, {
            onConflict: 'user_id,summary_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`[sync-garmin-sleep] Error upserting sleep summary ${summary.summaryId}:`, upsertError);
          continue;
        }

        // Check if this was an insert or update
        const { data: existingData } = await supabase
          .from('garmin_sleep_summaries')
          .select('created_at, updated_at')
          .eq('user_id', userId)
          .eq('summary_id', summary.summaryId)
          .single();

        if (existingData) {
          if (existingData.created_at === existingData.updated_at) {
            summariesAdded++;
          } else {
            summariesUpdated++;
          }
        }

        console.log(`[sync-garmin-sleep] Successfully processed sleep summary ${summary.summaryId}`);
      } catch (error) {
        console.error(`[sync-garmin-sleep] Error processing sleep summary ${summary.summaryId}:`, error);
      }
    }

    // Update sync status to completed
    if (syncControl) {
      await supabase
        .from('garmin_sync_control')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString()
        })
        .eq('id', syncControl.id);
    }

    const result: SyncResult = {
      success: true,
      summariesProcessed: sleepSummaries.length,
      summariesAdded,
      summariesUpdated
    };

    console.log(`[sync-garmin-sleep] Sync completed successfully:`, result);

    return new Response(JSON.stringify({
      message: 'Sleep data sync completed successfully',
      result,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sync-garmin-sleep] Fatal error:', error);

    // Update sync status to failed if we have syncControl
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const token = authHeader.replace('Bearer ', '');
        
        // Only try to get user if it's not service role key
        if (token !== supabaseServiceKey) {
          const { data: { user } } = await supabase.auth.getUser(token);
          
          if (user) {
            await supabase
              .from('garmin_sync_control')
              .update({
                status: 'failed',
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
              .eq('sync_type', 'sleep')
              .eq('status', 'pending');
          }
        }
      }
    } catch (updateError) {
      console.error('[sync-garmin-sleep] Error updating sync status:', updateError);
    }

    return new Response(JSON.stringify({
      error: 'Sleep sync failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});