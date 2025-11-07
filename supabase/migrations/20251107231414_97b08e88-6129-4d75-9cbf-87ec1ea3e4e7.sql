-- Create RPC function for atomic training plan workout updates
-- This ensures delete + insert + update operations happen atomically
CREATE OR REPLACE FUNCTION public.update_training_plan_workouts(
  plan_id_param uuid,
  workouts_data jsonb,
  plan_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  affected_rows integer;
  result jsonb;
BEGIN
  -- Step 1: Delete existing workouts for this plan
  DELETE FROM public.training_plan_workouts 
  WHERE plan_id = plan_id_param;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  -- Step 2: Insert new workouts
  INSERT INTO public.training_plan_workouts (
    plan_id,
    user_id,
    week_number,
    workout_date,
    day_of_week,
    title,
    description,
    workout_type,
    distance_meters,
    duration_minutes,
    target_pace_min_km,
    intensity_zone,
    intensity_level,
    status
  )
  SELECT 
    (w->>'plan_id')::uuid,
    (w->>'user_id')::uuid,
    (w->>'week_number')::integer,
    (w->>'workout_date')::date,
    (w->>'day_of_week')::integer,
    w->>'title',
    w->>'description',
    w->>'workout_type',
    (w->>'distance_meters')::integer,
    (w->>'duration_minutes')::integer,
    (w->>'target_pace_min_km')::numeric,
    (w->>'intensity_zone')::numeric,
    w->>'intensity_level',
    COALESCE(w->>'status', 'planned')
  FROM jsonb_array_elements(workouts_data) AS w;
  
  -- Step 3: Update the training plan metadata
  UPDATE public.training_plans
  SET
    total_workouts = (plan_updates->>'total_workouts')::integer,
    total_weeks = (plan_updates->>'total_weeks')::integer,
    weekly_volume_km = (plan_updates->>'weekly_volume_km')::numeric,
    peak_week_volume_km = (plan_updates->>'peak_week_volume_km')::numeric,
    updated_at = now()
  WHERE id = plan_id_param;
  
  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'deleted_workouts', affected_rows,
    'inserted_workouts', jsonb_array_length(workouts_data),
    'plan_id', plan_id_param
  );
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback happens automatically on exception
  RAISE EXCEPTION 'Failed to update training plan workouts: %', SQLERRM;
END;
$function$;

COMMENT ON FUNCTION public.update_training_plan_workouts IS 
'Atomically updates training plan workouts: deletes old workouts, inserts new ones, and updates plan metadata. All operations are transactional.';