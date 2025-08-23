-- Create or replace trigger function to process Garmin activity chart from webhook logs
CREATE OR REPLACE FUNCTION public.trg_process_activity_chart_from_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only process activity details notifications
  IF NEW.webhook_type IS NULL OR lower(NEW.webhook_type) NOT LIKE '%detail%' OR lower(NEW.webhook_type) NOT LIKE '%activity%' THEN
    RETURN NEW;
  END IF;

  -- Fire and forget HTTP call to Edge Function
  PERFORM extensions.net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/process-activity-chart-from-garmin-log',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('webhook_log_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Create trigger on garmin_webhook_logs for inserts
DROP TRIGGER IF EXISTS after_insert_process_activity_chart_from_log ON public.garmin_webhook_logs;
CREATE TRIGGER after_insert_process_activity_chart_from_log
AFTER INSERT ON public.garmin_webhook_logs
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_activity_chart_from_log();