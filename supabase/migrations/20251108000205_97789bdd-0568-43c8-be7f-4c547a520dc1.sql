-- Fix update_training_plan_workouts RPC function to remove non-existent week_number column
CREATE OR REPLACE FUNCTION update_training_plan_workouts(
  p_plan_id UUID,
  p_user_id UUID,
  p_workouts JSONB,
  p_total_workouts INT,
  p_total_weeks INT
)
RETURNS VOID AS $$
BEGIN
  -- Delete old workouts for this plan
  DELETE FROM training_plan_workouts
  WHERE plan_id = p_plan_id;

  -- Insert new workouts
  INSERT INTO training_plan_workouts (
    user_id,
    plan_id,
    workout_date,
    title,
    description,
    workout_type,
    target_pace_min_km,
    target_hr_zone,
    distance_meters,
    duration_minutes,
    status
  )
  SELECT
    p_user_id,
    p_plan_id,
    (w->>'scheduled_date')::date,
    w->>'title',
    w->>'description',
    w->>'type',
    (w->>'target_pace_min_km')::numeric,
    w->>'target_hr_zone',
    (w->>'distance_km')::numeric * 1000,
    (w->>'duration_minutes')::numeric,
    COALESCE(w->>'status', 'pending')
  FROM jsonb_array_elements(p_workouts) AS w;

  -- Update training plan metadata
  UPDATE training_plans
  SET
    total_workouts = p_total_workouts,
    duration_weeks = p_total_weeks,
    updated_at = NOW()
  WHERE id = p_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;