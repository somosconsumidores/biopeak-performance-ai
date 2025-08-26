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
    console.log('[fix-cron-job] Starting cron job correction...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check current cron jobs using direct SQL
    const { data: currentJobs, error: queryError } = await supabase
      .rpc('exec_sql', { 
        sql: 'SELECT jobname, schedule, command, active FROM cron.job WHERE jobname LIKE \'%token%\'' 
      });

    console.log('[fix-cron-job] Current cron jobs:', currentJobs);

    // Delete the old problematic cron job using direct SQL
    const { data: deleteResult, error: deleteError } = await supabase
      .rpc('exec_sql', {
        sql: 'SELECT cron.unschedule(\'proactive-token-renewal\') as result'
      });

    if (deleteError) {
      console.log('[fix-cron-job] Error deleting old cron job (might not exist):', deleteError);
    } else {
      console.log('[fix-cron-job] Delete result:', deleteResult);
    }

    // Create the new corrected cron job using direct SQL
    const cronJobSQL = `
      SELECT cron.schedule(
        'scheduled-token-renewal',
        '*/30 * * * *',
        $$
        SELECT
          net.http_post(
              url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/scheduled-token-renewal',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
              body:=concat('{"time": "', now(), '"}')::jsonb
          ) as request_id;
        $$
      ) as job_id
    `;

    const { data: scheduleResult, error: scheduleError } = await supabase
      .rpc('exec_sql', { sql: cronJobSQL });

    if (scheduleError) {
      console.error('[fix-cron-job] Error creating new cron job:', scheduleError);
      throw scheduleError;
    }

    console.log('[fix-cron-job] Successfully created new cron job:', scheduleResult);

    // Verify the new cron job using direct SQL
    const { data: newJobs, error: verifyError } = await supabase
      .rpc('exec_sql', { 
        sql: 'SELECT jobname, schedule, command, active FROM cron.job WHERE jobname LIKE \'%token%\'' 
      });

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