-- Create workout_classification table with RLS and upsert support
CREATE TABLE IF NOT EXISTS public.workout_classification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  detected_workout_type TEXT NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure uniqueness by user/activity
CREATE UNIQUE INDEX IF NOT EXISTS workout_classification_user_activity_uidx
  ON public.workout_classification (user_id, activity_id);

-- Enable RLS
ALTER TABLE public.workout_classification ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  -- Service role can manage everything
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workout_classification'
      AND policyname = 'Service role can manage workout classification'
  ) THEN
    CREATE POLICY "Service role can manage workout classification"
    ON public.workout_classification
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;

  -- Users can view their own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workout_classification'
      AND policyname = 'Users can view their own workout classification'
  ) THEN
    CREATE POLICY "Users can view their own workout classification"
    ON public.workout_classification
    FOR SELECT
    TO PUBLIC
    USING (auth.uid() = user_id);
  END IF;

  -- Users can insert their own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workout_classification'
      AND policyname = 'Users can insert their own workout classification'
  ) THEN
    CREATE POLICY "Users can insert their own workout classification"
    ON public.workout_classification
    FOR INSERT
    TO PUBLIC
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Users can update their own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workout_classification'
      AND policyname = 'Users can update their own workout classification'
  ) THEN
    CREATE POLICY "Users can update their own workout classification"
    ON public.workout_classification
    FOR UPDATE
    TO PUBLIC
    USING (auth.uid() = user_id);
  END IF;
END $$;
