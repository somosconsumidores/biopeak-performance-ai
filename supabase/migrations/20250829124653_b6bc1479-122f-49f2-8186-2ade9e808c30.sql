-- Disable classify-workouts invocation by making the trigger function a no-op
CREATE OR REPLACE FUNCTION public.invoke_classify_workouts_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Disabled on 2025-08-29: no-op to prevent classify-workouts execution
  RETURN NEW;
END;
$function$;