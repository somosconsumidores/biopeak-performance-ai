
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  timeRange: 'last_30_days' | 'custom';
  start?: number;
  end?: number;
  activityDetailsTimeRange?: {
    start: number;
    end: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[backfill-activities] Function started');

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[backfill-activities] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[backfill-activities] User authenticated:', user.id);

    // Parse request body
    let requestBody: BackfillRequest;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('access_token, expires_at, garmin_user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('[backfill-activities] Token error:', tokenError);
      return new Response(JSON.stringify({ error: 'No Garmin token found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      return new Response(JSON.stringify({ error: 'Garmin token expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate time range
    let startTime: number;
    let endTime: number;

    if (requestBody.timeRange === 'last_30_days') {
      endTime = Math.floor(Date.now() / 1000);
      startTime = endTime - (30 * 24 * 60 * 60); // 30 days ago
    } else if (requestBody.timeRange === 'custom') {
      if (!requestBody.start || !requestBody.end) {
        return new Response(JSON.stringify({ error: 'Custom range requires start and end timestamps' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      startTime = requestBody.start;
      endTime = requestBody.end;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid timeRange. Must be "last_30_days" or "custom"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[backfill-activities] Processing range from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);

    // Trigger activities backfill using Garmin's asynchronous endpoint (no pull notifications)
    const activitiesResult = await handleActivitiesBackfill(supabase, user.id, tokenData, startTime, endTime);
    
    // Then, trigger activity details backfill (asynchronous)
    // Use custom time range for details if provided, otherwise use last 15 days for details
    let detailsStartTime = endTime - (15 * 24 * 60 * 60); // Default to 15 days for details
    let detailsEndTime = endTime;
    
    if (requestBody.activityDetailsTimeRange) {
      detailsStartTime = requestBody.activityDetailsTimeRange.start;
      detailsEndTime = requestBody.activityDetailsTimeRange.end;
      console.log(`[backfill-activities] Using custom time range for activity details: ${new Date(detailsStartTime * 1000).toISOString()} to ${new Date(detailsEndTime * 1000).toISOString()}`);
    } else {
      console.log(`[backfill-activities] Using default 15-day range for activity details: ${new Date(detailsStartTime * 1000).toISOString()} to ${new Date(detailsEndTime * 1000).toISOString()}`);
    }
    
    const detailsResult = await triggerActivityDetailsBackfill(supabase, user.id, tokenData, detailsStartTime, detailsEndTime);

    return new Response(JSON.stringify({
      success: true,
      activities: activitiesResult,
      activityDetails: detailsResult,
      message: 'Backfill triggered successfully. Activities and details will arrive via webhook in the next few minutes.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[backfill-activities] Unexpected error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleActivitiesBackfill(supabase: any, userId: string, tokenData: any, startTime: number, endTime: number) {
  console.log(`[handleActivitiesBackfill] Triggering async backfill for time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
  
  try {
    // Record the backfill request in the database first
    const { data: backfillRecord, error: recordError } = await supabase
      .from('garmin_backfill_requests')
      .insert({
        user_id: userId,
        garmin_user_id: tokenData.garmin_user_id,
        request_type: 'activities',
        time_range_start: startTime,
        time_range_end: endTime,
        status: 'triggered'
      })
      .select('id')
      .single();

    if (recordError) {
      console.error('[handleActivitiesBackfill] Error recording backfill request:', recordError);
      throw new Error('Failed to record backfill request');
    }

    // Use the correct Garmin asynchronous backfill endpoint
    const backfillUrl = `https://apis.garmin.com/wellness-api/rest/backfill/activities?summaryStartTimeInSeconds=${startTime}&summaryEndTimeInSeconds=${endTime}`;
    
    console.log(`[handleActivitiesBackfill] Triggering backfill: ${backfillUrl}`);
    
    const response = await fetch(backfillUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`[handleActivitiesBackfill] Backfill response status: ${response.status}`);
    
    if (response.status === 202) {
      // HTTP 202 Accepted - backfill process started successfully
      console.log(`[handleActivitiesBackfill] Activities backfill triggered successfully. Data will arrive via webhook.`);
      
      // Update status to in_progress
      await supabase
        .from('garmin_backfill_requests')
        .update({ status: 'in_progress' })
        .eq('id', backfillRecord.id);
      
      return {
        triggered: true,
        message: `Activities backfill initiated for ${Math.ceil((endTime - startTime) / (24 * 60 * 60))} days. Data will arrive via webhook.`,
        backfillRequestId: backfillRecord.id
      };
    } else if (response.status === 409) {
      // HTTP 409 Conflict - duplicate request for same period
      console.log(`[handleActivitiesBackfill] Duplicate backfill request detected (409)`);
      
      await supabase
        .from('garmin_backfill_requests')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          error_message: 'Duplicate request - period already processed'
        })
        .eq('id', backfillRecord.id);
      
      return {
        triggered: false,
        message: 'Activities backfill already requested for this time period.',
        backfillRequestId: backfillRecord.id
      };
    } else if (response.status === 401) {
      await supabase
        .from('garmin_backfill_requests')
        .update({ 
          status: 'failed',
          error_message: 'Unauthorized - token expired'
        })
        .eq('id', backfillRecord.id);
      
      throw new Error('Unauthorized - token may be expired');
    } else {
      const errorText = await response.text();
      console.error(`[handleActivitiesBackfill] Unexpected response status: ${response.status}`);
      console.error(`[handleActivitiesBackfill] Error response: ${errorText}`);
      
      await supabase
        .from('garmin_backfill_requests')
        .update({ 
          status: 'failed',
          error_message: `API error: ${response.status} - ${errorText}`
        })
        .eq('id', backfillRecord.id);
      
      throw new Error(`Garmin API error: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error(`[handleActivitiesBackfill] Error triggering backfill:`, error);
    throw error;
  }
}

async function triggerActivityDetailsBackfill(supabase: any, userId: string, tokenData: any, startTime: number, endTime: number) {
  const MAX_TIME_RANGE = 30 * 24 * 60 * 60; // 30 days in seconds (Garmin's max)
  const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests

  let triggeredRequests = 0;
  let failedRequests = 0;
  const backfillRequestIds: string[] = [];

  // Process in 30-day chunks for activity details
  for (let currentEndTime = endTime; currentEndTime > startTime; currentEndTime -= MAX_TIME_RANGE) {
    const currentStartTime = Math.max(currentEndTime - MAX_TIME_RANGE, startTime);
    
    console.log(`[backfill-activities] Triggering activity details backfill for period ${new Date(currentStartTime * 1000).toISOString()} to ${new Date(currentEndTime * 1000).toISOString()}`);
    
    try {
      // Record the backfill request in the database
      const { data: backfillRecord, error: recordError } = await supabase
        .from('garmin_backfill_requests')
        .insert({
          user_id: userId,
          garmin_user_id: tokenData.garmin_user_id,
          request_type: 'activity_details',
          time_range_start: currentStartTime,
          time_range_end: currentEndTime,
          status: 'triggered'
        })
        .select('id')
        .single();

      if (recordError) {
        console.error('[backfill-activities] Error recording backfill request:', recordError);
        failedRequests++;
        continue;
      }

      // Trigger the asynchronous backfill
      const apiUrl = new URL('https://apis.garmin.com/wellness-api/rest/backfill/activityDetails');
      apiUrl.searchParams.append('summaryStartTimeInSeconds', currentStartTime.toString());
      apiUrl.searchParams.append('summaryEndTimeInSeconds', currentEndTime.toString());

      const garminResponse = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (garminResponse.ok) {
        // Empty response is expected for backfill trigger
        console.log(`[backfill-activities] Activity details backfill triggered successfully for period`);
        
        // Update status to in_progress
        await supabase
          .from('garmin_backfill_requests')
          .update({ status: 'in_progress' })
          .eq('id', backfillRecord.id);
          
        backfillRequestIds.push(backfillRecord.id);
        triggeredRequests++;
      } else if (garminResponse.status === 409) {
        // Duplicate request - this period was already requested
        console.log(`[backfill-activities] Activity details backfill already processed for this period`);
        
        await supabase
          .from('garmin_backfill_requests')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            error_message: 'Duplicate request - period already processed'
          })
          .eq('id', backfillRecord.id);
          
        triggeredRequests++;
      } else {
        const errorText = await garminResponse.text();
        console.error(`[backfill-activities] Activity details API error:`, garminResponse.status, errorText);
        
        await supabase
          .from('garmin_backfill_requests')
          .update({ 
            status: 'failed',
            error_message: `API error: ${garminResponse.status} - ${errorText}`
          })
          .eq('id', backfillRecord.id);
          
        failedRequests++;
      }

      // Delay between requests
      if (currentStartTime > startTime) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }

    } catch (error) {
      console.error(`[backfill-activities] Error triggering activity details backfill:`, error);
      failedRequests++;
      
      if (currentStartTime > startTime) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }
  }

  return {
    triggered: triggeredRequests,
    failed: failedRequests,
    backfillRequestIds: backfillRequestIds,
    message: 'Activity details backfill triggered. Data will arrive via webhook notifications.'
  };
}
