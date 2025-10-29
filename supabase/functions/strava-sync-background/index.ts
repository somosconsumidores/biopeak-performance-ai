import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id } = await req.json();
    
    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log('🔵 [strava-sync-background] Starting background sync for user:', user_id);

    // Check if there's already a job in progress
    const { data: existingJob } = await supabase
      .from('strava_sync_jobs')
      .select('id, status')
      .eq('user_id', user_id)
      .in('status', ['pending', 'in_progress'])
      .maybeSingle();

    if (existingJob) {
      console.log('⚠️ [strava-sync-background] Job already in progress:', existingJob.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sync already in progress',
          job_id: existingJob.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create job entry
    const { data: job, error: jobError } = await supabase
      .from('strava_sync_jobs')
      .insert({ user_id, status: 'pending' })
      .select()
      .single();

    if (jobError) throw jobError;

    console.log('✅ [strava-sync-background] Job created:', job.id);

    // Update status to in_progress
    await supabase
      .from('strava_sync_jobs')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', job.id);

    // Call strava-sync-optimized internally
    console.log('🔵 [strava-sync-background] Calling strava-sync-optimized...');
    
    const syncResponse = await fetch(
      `${supabaseUrl}/functions/v1/strava-sync-optimized`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id }),
      }
    );

    const syncResult = await syncResponse.json();

    if (syncResult.success) {
      // Update job as completed
      await supabase
        .from('strava_sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          activities_synced: syncResult.synced || 0,
          total_activities: syncResult.total || 0,
          metadata: { isIncremental: syncResult.isIncremental },
        })
        .eq('id', job.id);

      console.log('✅ [strava-sync-background] Sync completed:', syncResult);
    } else {
      // Update job as failed
      await supabase
        .from('strava_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: syncResult.error || 'Unknown error',
        })
        .eq('id', job.id);

      console.error('❌ [strava-sync-background] Sync failed:', syncResult.error);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: job.id,
        sync_result: syncResult 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [strava-sync-background] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
