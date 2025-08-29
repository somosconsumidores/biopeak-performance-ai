-- Create triggers to auto-build chart data and GPS coordinates into activity_coordinates via edge function
-- Uses Authorization header with anon key to satisfy verify_jwt on calculate-activity-chart-data

-- Strava details -> calculate-activity-chart-data (activity_source = 'strava')
CREATE OR REPLACE FUNCTION public.trg_process_chart_after_insert_strava()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/calculate-activity-chart-data',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'activity_id', NEW.strava_activity_id::text,
      'activity_source', 'strava'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_chart_after_insert_strava ON public.strava_activity_details;
CREATE TRIGGER process_chart_after_insert_strava
AFTER INSERT ON public.strava_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_process_chart_after_insert_strava();


-- Polar details -> calculate-activity-chart-data (activity_source = 'polar')
CREATE OR REPLACE FUNCTION public.trg_process_chart_after_insert_polar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/calculate-activity-chart-data',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'activity_id', NEW.activity_id,
      'activity_source', 'polar'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_chart_after_insert_polar ON public.polar_activity_details;
CREATE TRIGGER process_chart_after_insert_polar
AFTER INSERT ON public.polar_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_process_chart_after_insert_polar();


-- Strava GPX details -> calculate-activity-chart-data (activity_source = 'strava_gpx')
CREATE OR REPLACE FUNCTION public.trg_process_chart_after_insert_strava_gpx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/calculate-activity-chart-data',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'activity_id', NEW.activity_id,
      'activity_source', 'strava_gpx'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_chart_after_insert_strava_gpx ON public.strava_gpx_activity_details;
CREATE TRIGGER process_chart_after_insert_strava_gpx
AFTER INSERT ON public.strava_gpx_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_process_chart_after_insert_strava_gpx();


-- Zepp GPX details -> calculate-activity-chart-data (activity_source = 'zepp_gpx')
CREATE OR REPLACE FUNCTION public.trg_process_chart_after_insert_zepp_gpx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/calculate-activity-chart-data',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'activity_id', NEW.activity_id,
      'activity_source', 'zepp_gpx'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_chart_after_insert_zepp_gpx ON public.zepp_gpx_activity_details;
CREATE TRIGGER process_chart_after_insert_zepp_gpx
AFTER INSERT ON public.zepp_gpx_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_process_chart_after_insert_zepp_gpx();
