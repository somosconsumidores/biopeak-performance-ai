-- PAUSE classify-workouts triggers on all_activities
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_classify_workouts_after_insert') THEN
    DROP TRIGGER trg_classify_workouts_after_insert ON public.all_activities;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoke_classify_workouts_after_insert') THEN
    DROP TRIGGER trg_invoke_classify_workouts_after_insert ON public.all_activities;
  END IF;
END $$;