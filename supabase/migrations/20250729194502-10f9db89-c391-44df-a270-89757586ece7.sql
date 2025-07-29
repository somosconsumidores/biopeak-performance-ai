-- Create new hourly cron job for proactive token renewal
SELECT cron.schedule(
  'proactive-token-renewal',
  '0 * * * *', -- Run every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/proactive-token-renewal',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2NDU2OSwiZXhwIjoyMDY3NzQwNTY5fQ.FrqzFS_hZQOwJTCW4TfBDbNbXJ8LjcN_pJ3QdLZ4yrI"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);