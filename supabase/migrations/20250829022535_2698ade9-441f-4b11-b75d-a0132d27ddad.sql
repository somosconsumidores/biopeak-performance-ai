-- Function + Trigger to auto-invoke classify-workouts-from-series after inserts on activity_chart_data
CREATE OR REPLACE FUNCTION public.invoke_classify_workouts_from_series()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Fire-and-forget HTTP call to Edge Function with the new row identifiers
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/classify-workouts-from-series',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      -- Use project anon key just to satisfy verify_jwt on the edge function
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'activity_id', NEW.activity_id
    )
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_classify_from_series_after_insert'
  ) THEN
    CREATE TRIGGER trg_auto_classify_from_series_after_insert
    AFTER INSERT ON public.activity_chart_data
    FOR EACH ROW
    EXECUTE FUNCTION public.invoke_classify_workouts_from_series();
  END IF;
END $$;