-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cleanup of expired subscriptions every 6 hours
SELECT cron.schedule(
  'cleanup-expired-subscriptions',
  '0 */6 * * *', -- Every 6 hours at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/cleanup-expired-subscriptions',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Log the scheduled job
DO $$
BEGIN
  RAISE NOTICE 'Cron job "cleanup-expired-subscriptions" scheduled to run every 6 hours';
END $$;
