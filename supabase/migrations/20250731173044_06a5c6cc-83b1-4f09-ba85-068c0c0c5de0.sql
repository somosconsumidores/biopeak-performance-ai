-- First, let's check the current cron job
SELECT jobname, schedule, command, active FROM cron.job WHERE jobname LIKE '%token%' OR command LIKE '%token%';

-- Update the existing cron job to use the correct function and better frequency
UPDATE cron.job 
SET command = $$
  select
    net.http_post(
        url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/scheduled-token-renewal',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
$$,
    schedule = '*/30 * * * *',  -- Every 30 minutes instead of every hour
    updated_at = now()
WHERE jobname = 'proactive-token-renewal';

-- If the cron job doesn't exist, create it
INSERT INTO cron.job (jobname, schedule, command, active)
SELECT 
  'scheduled-token-renewal',
  '*/30 * * * *',
  $$
  select
    net.http_post(
        url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/scheduled-token-renewal',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname IN ('proactive-token-renewal', 'scheduled-token-renewal')
);

-- Verify the cron job configuration
SELECT jobname, schedule, active, created_at, updated_at FROM cron.job WHERE jobname LIKE '%token%';