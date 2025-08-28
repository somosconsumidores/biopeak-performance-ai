-- Create trigger function to invoke classify-workouts after variation analysis writes
CREATE OR REPLACE FUNCTION public.invoke_classify_workouts_after_variation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Fire-and-forget call to Edge Function with user_id and reclassify=true
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/classify-workouts',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'reclassify', true
    )
  );
  RETURN NEW;
END;
$$;

-- Create trigger only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoke_classify_after_variation'
  ) THEN
    CREATE TRIGGER trg_invoke_classify_after_variation
    AFTER INSERT OR UPDATE ON public.variation_analysis
    FOR EACH ROW
    EXECUTE FUNCTION public.invoke_classify_workouts_after_variation();
  END IF;
END $$;