-- Create function to refresh mv_all_activities_30_days
CREATE OR REPLACE FUNCTION public.refresh_mv_all_activities_30_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_all_activities_30_days;
END;
$$;

-- Create function to refresh mv_active_subscribers
CREATE OR REPLACE FUNCTION public.refresh_mv_active_subscribers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_active_subscribers;
END;
$$;

-- Schedule cron job to refresh materialized views at midnight (00:00) every day
SELECT cron.schedule(
  'refresh-materialized-views-midnight',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/refresh-materialized-views',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);