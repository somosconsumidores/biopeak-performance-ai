-- Phase 1: Data Structure for Premium AI Coach
-- 1) Add gender to profiles (nullable) with safe check constraint
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender text;

-- Add a CHECK constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_gender_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_gender_check
    CHECK (
      gender IS NULL OR gender IN (
        'male', 'female', 'other', 'prefer_not_to_say'
      )
    );
  END IF;
END $$;

-- 2) training_plans table
CREATE TABLE IF NOT EXISTS public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_name text,
  goal_type text NOT NULL, -- e.g., '5k', '10k', 'half_marathon', 'marathon', 'general_fitness'
  target_event_date date,  -- date of race/goal (optional)
  start_date date NOT NULL,
  end_date date,
  weeks integer NOT NULL CHECK (weeks > 0),
  status text NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'completed' | 'archived'
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for training_plans
CREATE INDEX IF NOT EXISTS idx_training_plans_user_id ON public.training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_status ON public.training_plans(status);

-- 3) training_plan_preferences table (stores availability and preferences used to generate a plan)
CREATE TABLE IF NOT EXISTS public.training_plan_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  days_per_week smallint NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  days_of_week smallint[] NOT NULL DEFAULT '{}', -- values 0-6 (Sun-Sat) or 1-7 based on app convention
  long_run_weekday smallint CHECK (long_run_weekday BETWEEN 0 AND 6),
  start_asap boolean NOT NULL DEFAULT true,
  start_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for training_plan_preferences
CREATE INDEX IF NOT EXISTS idx_training_plan_preferences_user_id ON public.training_plan_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_training_plan_preferences_plan_id ON public.training_plan_preferences(plan_id);

-- 4) training_plan_workouts table (agenda pessoal)
CREATE TABLE IF NOT EXISTS public.training_plan_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  title text NOT NULL,
  description text,
  workout_type text, -- e.g., 'easy', 'long_run', 'interval', 'tempo', 'rest', etc.
  target_pace_min_km numeric, -- optional target pace
  target_hr_zone text,        -- optional HR zone
  distance_meters numeric,    -- planned distance
  duration_minutes numeric,   -- planned duration
  status text NOT NULL DEFAULT 'planned', -- 'planned' | 'completed' | 'skipped' | 'moved'
  completed_activity_source text, -- link to actual activity
  completed_activity_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for training_plan_workouts
CREATE INDEX IF NOT EXISTS idx_training_plan_workouts_user_date ON public.training_plan_workouts(user_id, workout_date);
CREATE INDEX IF NOT EXISTS idx_training_plan_workouts_user_plan ON public.training_plan_workouts(user_id, plan_id);

-- Enable RLS
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plan_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plan_workouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role can manage all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Service role can manage training plans'
  ) THEN
    CREATE POLICY "Service role can manage training plans"
    ON public.training_plans
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_preferences' AND policyname = 'Service role can manage training plan preferences'
  ) THEN
    CREATE POLICY "Service role can manage training plan preferences"
    ON public.training_plan_preferences
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_workouts' AND policyname = 'Service role can manage training plan workouts'
  ) THEN
    CREATE POLICY "Service role can manage training plan workouts"
    ON public.training_plan_workouts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Users can view their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Users can view their own training plans'
  ) THEN
    CREATE POLICY "Users can view their own training plans"
    ON public.training_plans
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_preferences' AND policyname = 'Users can view their own training plan preferences'
  ) THEN
    CREATE POLICY "Users can view their own training plan preferences"
    ON public.training_plan_preferences
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_workouts' AND policyname = 'Users can view their own training plan workouts'
  ) THEN
    CREATE POLICY "Users can view their own training plan workouts"
    ON public.training_plan_workouts
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can insert their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Users can insert their own training plans'
  ) THEN
    CREATE POLICY "Users can insert their own training plans"
    ON public.training_plans
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_preferences' AND policyname = 'Users can insert their own training plan preferences'
  ) THEN
    CREATE POLICY "Users can insert their own training plan preferences"
    ON public.training_plan_preferences
    FOR INSERT
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.training_plans tp
        WHERE tp.id = training_plan_preferences.plan_id AND tp.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_workouts' AND policyname = 'Users can insert their own training plan workouts'
  ) THEN
    CREATE POLICY "Users can insert their own training plan workouts"
    ON public.training_plan_workouts
    FOR INSERT
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.training_plans tp
        WHERE tp.id = training_plan_workouts.plan_id AND tp.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Users can update their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Users can update their own training plans'
  ) THEN
    CREATE POLICY "Users can update their own training plans"
    ON public.training_plans
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_preferences' AND policyname = 'Users can update their own training plan preferences'
  ) THEN
    CREATE POLICY "Users can update their own training plan preferences"
    ON public.training_plan_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.training_plans tp
        WHERE tp.id = training_plan_preferences.plan_id AND tp.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_workouts' AND policyname = 'Users can update their own training plan workouts'
  ) THEN
    CREATE POLICY "Users can update their own training plan workouts"
    ON public.training_plan_workouts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.training_plans tp
        WHERE tp.id = training_plan_workouts.plan_id AND tp.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Users can delete their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plans' AND policyname = 'Users can delete their own training plans'
  ) THEN
    CREATE POLICY "Users can delete their own training plans"
    ON public.training_plans
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_preferences' AND policyname = 'Users can delete their own training plan preferences'
  ) THEN
    CREATE POLICY "Users can delete their own training plan preferences"
    ON public.training_plan_preferences
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_plan_workouts' AND policyname = 'Users can delete their own training plan workouts'
  ) THEN
    CREATE POLICY "Users can delete their own training plan workouts"
    ON public.training_plan_workouts
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Triggers to auto-update updated_at
DO $$
BEGIN
  -- training_plans
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_training_plans_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_training_plans_updated_at
    BEFORE UPDATE ON public.training_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- training_plan_preferences
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_training_plan_preferences_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_training_plan_preferences_updated_at
    BEFORE UPDATE ON public.training_plan_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- training_plan_workouts
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_training_plan_workouts_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_training_plan_workouts_updated_at
    BEFORE UPDATE ON public.training_plan_workouts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;