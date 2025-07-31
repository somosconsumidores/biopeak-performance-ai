import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fix-cron-job] Starting cron job correction...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check current cron jobs
    const { data: currentJobs, error: queryError } = await supabase
      .from('pg_cron.job')
      .select('jobname, schedule, command, active');

    console.log('[fix-cron-job] Current cron jobs:', currentJobs);

    // Delete the old problematic cron job
    const { error: deleteError } = await supabase.rpc('cron.unschedule', {
      job_name: 'proactive-token-renewal'
    });

    if (deleteError) {
      console.log('[fix-cron-job] Error deleting old cron job (might not exist):', deleteError);
    }

    // Create the new corrected cron job
    const { data: scheduleResult, error: scheduleError } = await supabase.rpc('cron.schedule', {
      job_name: 'scheduled-token-renewal',
      cron_schedule: '*/30 * * * *', // Every 30 minutes
      sql: `
        SELECT
          net.http_post(
              url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/scheduled-token-renewal',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
              body:=concat('{"time": "', now(), '"}')::jsonb
          ) as request_id;
      `
    });

    if (scheduleError) {
      console.error('[fix-cron-job] Error creating new cron job:', scheduleError);
      throw scheduleError;
    }

    console.log('[fix-cron-job] Successfully created new cron job:', scheduleResult);

    // Verify the new cron job
    const { data: newJobs, error: verifyError } = await supabase
      .from('pg_cron.job')
      .select('jobname, schedule, command, active')
      .like('jobname', '%token%');

    console.log('[fix-cron-job] Updated cron jobs:', newJobs);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cron job successfully updated to use scheduled-token-renewal with 30-minute frequency',
        oldJob: 'proactive-token-renewal deleted',
        newJob: 'scheduled-token-renewal created with */30 * * * * schedule',
        currentJobs: newJobs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fix-cron-job] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fix cron job', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});