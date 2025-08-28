-- Create trigger to invoke classify-workouts automatically after inserting into all_activities
-- This ensures detected_workout_type is set promptly for new activities (e.g., Zepp GPX)

DO $$
BEGIN
  -- Create trigger only if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoke_classify_workouts_after_insert'
  ) THEN
    CREATE TRIGGER trg_invoke_classify_workouts_after_insert
    AFTER INSERT ON public.all_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.invoke_classify_workouts_after_insert();
  END IF;
END $$;