-- Trigger: classify newly inserted activities automatically via Edge Function
-- Creates a trigger function and trigger on public.all_activities to invoke the
-- classify-workouts Edge Function after each insert.

-- Safety first: drop existing trigger if any
DROP TRIGGER IF EXISTS trg_classify_workouts_after_insert ON public.all_activities;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.invoke_classify_workouts_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Fire-and-forget call to Edge Function with the new user's id
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/classify-workouts',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      -- Use the project anon key as a JWT to satisfy verify_jwt=true
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$;

-- Create the trigger on inserts
CREATE TRIGGER trg_classify_workouts_after_insert
AFTER INSERT ON public.all_activities
FOR EACH ROW
EXECUTE FUNCTION public.invoke_classify_workouts_after_insert();
