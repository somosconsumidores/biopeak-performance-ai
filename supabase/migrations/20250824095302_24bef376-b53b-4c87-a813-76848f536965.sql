-- Fix http_post calls in triggers to use net.http_post (not extensions.net.http_post)

-- Replace function: public.trg_process_activity_chart_from_log
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
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/process-activity-chart-from-garmin-log',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('webhook_log_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Replace function: public.trg_process_activity_chart_from_details
CREATE OR REPLACE FUNCTION public.trg_process_activity_chart_from_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Fire and forget call to Edge Function with user_id and activity_id
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/process-activity-chart-from-garmin-log',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('user_id', NEW.user_id, 'activity_id', NEW.activity_id)
  );
  RETURN NEW;
END;
$$;
