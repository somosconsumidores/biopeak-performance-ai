-- 1) Helper to map Polar user to internal user_id
CREATE OR REPLACE FUNCTION public.find_user_by_polar_id(polar_user_id_param bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  found_user_id UUID;
BEGIN
  -- Try x_user_id (numeric) first
  SELECT user_id INTO found_user_id
  FROM public.polar_tokens
  WHERE x_user_id = polar_user_id_param
    AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF found_user_id IS NOT NULL THEN
    RETURN found_user_id;
  END IF;

  -- Fallback: compare as text against polar_user_id column
  SELECT user_id INTO found_user_id
  FROM public.polar_tokens
  WHERE polar_user_id = polar_user_id_param::text
    AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN found_user_id;
END;
$$;

-- 2) Tables for Polar notifications (SleepWise + Continuous HR)
-- 2.1 Continuous HR events (store raw event payload and optional window metadata)
CREATE TABLE IF NOT EXISTS public.polar_continuous_hr_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  polar_user_id bigint,
  event_date date,
  window_start timestamptz,
  window_end timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.polar_continuous_hr_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own polar continuous hr events"
ON public.polar_continuous_hr_events
FOR INSERT
TO PUBLIC
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own polar continuous hr events"
ON public.polar_continuous_hr_events
FOR SELECT
TO PUBLIC
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own polar continuous hr events"
ON public.polar_continuous_hr_events
FOR UPDATE
TO PUBLIC
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own polar continuous hr events"
ON public.polar_continuous_hr_events
FOR DELETE
TO PUBLIC
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_polar_chr_user_date
ON public.polar_continuous_hr_events (user_id, event_date);

CREATE TRIGGER update_polar_chr_events_updated_at
BEFORE UPDATE ON public.polar_continuous_hr_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.2 SleepWise Circadian Bedtime
CREATE TABLE IF NOT EXISTS public.polar_sleepwise_bedtime (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  polar_user_id bigint,
  calendar_date date NOT NULL,
  bedtime_start timestamptz,
  bedtime_end timestamptz,
  confidence numeric,
  timezone text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, calendar_date)
);

ALTER TABLE public.polar_sleepwise_bedtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own sleepwise bedtime"
ON public.polar_sleepwise_bedtime
FOR INSERT
TO PUBLIC
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sleepwise bedtime"
ON public.polar_sleepwise_bedtime
FOR SELECT
TO PUBLIC
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sleepwise bedtime"
ON public.polar_sleepwise_bedtime
FOR UPDATE
TO PUBLIC
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sleepwise bedtime"
ON public.polar_sleepwise_bedtime
FOR DELETE
TO PUBLIC
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sleepwise_bedtime_user_date
ON public.polar_sleepwise_bedtime (user_id, calendar_date);

CREATE TRIGGER update_sleepwise_bedtime_updated_at
BEFORE UPDATE ON public.polar_sleepwise_bedtime
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.3 SleepWise Alertness (predictions array by date)
CREATE TABLE IF NOT EXISTS public.polar_sleepwise_alertness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  polar_user_id bigint,
  calendar_date date NOT NULL,
  predictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, calendar_date)
);

ALTER TABLE public.polar_sleepwise_alertness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own sleepwise alertness"
ON public.polar_sleepwise_alertness
FOR INSERT
TO PUBLIC
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sleepwise alertness"
ON public.polar_sleepwise_alertness
FOR SELECT
TO PUBLIC
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sleepwise alertness"
ON public.polar_sleepwise_alertness
FOR UPDATE
TO PUBLIC
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sleepwise alertness"
ON public.polar_sleepwise_alertness
FOR DELETE
TO PUBLIC
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sleepwise_alertness_user_date
ON public.polar_sleepwise_alertness (user_id, calendar_date);

CREATE TRIGGER update_sleepwise_alertness_updated_at
BEFORE UPDATE ON public.polar_sleepwise_alertness
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
