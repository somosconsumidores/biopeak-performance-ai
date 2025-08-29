-- Narrow classify trigger: call only for the specific activity that had its variation updated
CREATE OR REPLACE FUNCTION public.invoke_classify_workouts_after_variation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Call classify-workouts for a single activity instead of reclassifying everything
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/classify-workouts',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      -- Use the project anon key as a JWT to satisfy verify_jwt=true
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'activity_id', NEW.activity_id,
      'activity_source', NEW.activity_source
    )
  );
  RETURN NEW;
END;
$function$;