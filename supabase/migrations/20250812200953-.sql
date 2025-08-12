-- Schedule Strava token auto-renewal every 50 minutes via pg_cron
-- Ensures the job posts to the Edge Function 'scheduled-strava-token-renewal'
-- Uses pg_net for HTTP invocation

-- Unschedule existing job if present (idempotent)
select cron.unschedule('scheduled-strava-token-renewal');

-- Create or replace the cron job (runs at minute 0 and 50 of every hour => ~every 50 minutes)
select cron.schedule(
  'scheduled-strava-token-renewal',
  '*/50 * * * *',
  $$
  select net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/scheduled-strava-token-renewal',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify job registration
select jobname, schedule, active from cron.job where jobname = 'scheduled-strava-token-renewal';