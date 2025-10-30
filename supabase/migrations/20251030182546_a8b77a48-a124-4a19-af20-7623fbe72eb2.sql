-- Add trigger to automatically process BioPeak App activities through calculate-activity-chart-data
-- This ensures BioPeak activities get the same analytics as Garmin/Strava/Polar

CREATE OR REPLACE FUNCTION public.trg_process_chart_after_insert_biopeak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only process when status is 'completed'
  IF NEW.status = 'completed' THEN
    PERFORM net.http_post(
      url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/calculate-activity-chart-data',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'activity_id', NEW.id::text,
        'activity_source', 'biopeak_app'
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger on training_sessions
CREATE TRIGGER trg_process_chart_after_complete_biopeak
AFTER INSERT OR UPDATE OF status ON public.training_sessions
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.trg_process_chart_after_insert_biopeak();