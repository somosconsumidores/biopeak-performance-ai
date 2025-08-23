-- Create trigger to process activity chart when Garmin details summary row is inserted
CREATE OR REPLACE FUNCTION public.trg_process_activity_chart_from_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Fire and forget call to Edge Function with user_id and activity_id
  PERFORM extensions.net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/process-activity-chart-from-garmin-log',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('user_id', NEW.user_id, 'activity_id', NEW.activity_id)
  );
  RETURN NEW;
END;
$$;

-- Create trigger on garmin_activity_details firing only for the summary row (activity_summary present)
DROP TRIGGER IF EXISTS after_insert_process_activity_chart_from_details ON public.garmin_activity_details;
CREATE TRIGGER after_insert_process_activity_chart_from_details
AFTER INSERT ON public.garmin_activity_details
FOR EACH ROW
WHEN (NEW.activity_summary IS NOT NULL)
EXECUTE FUNCTION public.trg_process_activity_chart_from_details();