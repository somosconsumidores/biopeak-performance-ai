-- Create users_gas_model table to store GAS (Fitness–Fatigue) results per user and date
-- Includes RLS policies and updated_at trigger

-- 1) Table
CREATE TABLE IF NOT EXISTS public.users_gas_model (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_date date NOT NULL,
  fitness numeric NOT NULL,
  fatigue numeric NOT NULL,
  performance numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_gas_model_user_date_key UNIQUE (user_id, calendar_date)
);

-- 2) Enable RLS
ALTER TABLE public.users_gas_model ENABLE ROW LEVEL SECURITY;

-- 3) Policies
-- Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users_gas_model' AND policyname = 'Service role can manage gas model'
  ) THEN
    CREATE POLICY "Service role can manage gas model"
    ON public.users_gas_model
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Users can insert their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users_gas_model' AND policyname = 'Users can insert their own gas model rows'
  ) THEN
    CREATE POLICY "Users can insert their own gas model rows"
    ON public.users_gas_model
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Users can update their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users_gas_model' AND policyname = 'Users can update their own gas model rows'
  ) THEN
    CREATE POLICY "Users can update their own gas model rows"
    ON public.users_gas_model
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can view their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users_gas_model' AND policyname = 'Users can view their own gas model rows'
  ) THEN
    CREATE POLICY "Users can view their own gas model rows"
    ON public.users_gas_model
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can delete their own rows (optional but consistent with other tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users_gas_model' AND policyname = 'Users can delete their own gas model rows'
  ) THEN
    CREATE POLICY "Users can delete their own gas model rows"
    ON public.users_gas_model
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4) updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Attach trigger
DROP TRIGGER IF EXISTS trg_users_gas_model_updated_at ON public.users_gas_model;
CREATE TRIGGER trg_users_gas_model_updated_at
BEFORE UPDATE ON public.users_gas_model
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
