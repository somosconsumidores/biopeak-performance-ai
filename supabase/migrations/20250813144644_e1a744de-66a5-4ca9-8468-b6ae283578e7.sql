-- ZEPP INTEGRATION - DATABASE SETUP
-- 1) Tables

-- zepp_tokens: OAuth tokens and mapping to Zepp user
CREATE TABLE IF NOT EXISTS public.zepp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  zepp_user_id text,
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- zepp_activities: activity summaries
CREATE TABLE IF NOT EXISTS public.zepp_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  activity_type text,
  device_name text,
  start_time timestamptz,
  duration_in_seconds integer,
  distance_in_meters double precision,
  average_heart_rate_bpm integer,
  max_heart_rate_bpm integer,
  calories integer,
  has_route boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz,
  activity_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

-- zepp_activity_details: raw samples or processed arrays per activity
CREATE TABLE IF NOT EXISTS public.zepp_activity_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  activity_type text,
  device_name text,
  activity_name text,
  start_time_in_seconds bigint,
  upload_time_in_seconds bigint,
  duration_in_seconds integer,
  total_distance_in_meters double precision,
  -- Optional flat columns for single-sample rows (if we ever use row-per-sample)
  heart_rate integer,
  speed_meters_per_second double precision,
  latitude_in_degree double precision,
  longitude_in_degree double precision,
  elevation_in_meters double precision,
  sample_timestamp bigint,
  -- Aggregate JSON payloads for time-series (default strategy)
  samples jsonb,
  activity_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

-- zepp_sleep_summaries: daily sleep summary per user
CREATE TABLE IF NOT EXISTS public.zepp_sleep_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_date date NOT NULL,
  sleep_score integer,
  total_sleep_in_seconds integer,
  rem_sleep_in_seconds integer,
  light_sleep_in_seconds integer,
  deep_sleep_in_seconds integer,
  awake_in_seconds integer,
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, calendar_date)
);

-- zepp_webhook_logs: logs for webhook deliveries
CREATE TABLE IF NOT EXISTS public.zepp_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  zepp_user_id text,
  event_type text,
  payload jsonb NOT NULL,
  status text DEFAULT 'success',
  error_message text,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_zepp_tokens_user ON public.zepp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_zepp_tokens_zepp_user ON public.zepp_tokens(zepp_user_id);

CREATE INDEX IF NOT EXISTS idx_zepp_activities_user ON public.zepp_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_zepp_activities_start_time ON public.zepp_activities(start_time);
CREATE INDEX IF NOT EXISTS idx_zepp_activities_date ON public.zepp_activities(activity_date);

CREATE INDEX IF NOT EXISTS idx_zepp_activity_details_user ON public.zepp_activity_details(user_id);
CREATE INDEX IF NOT EXISTS idx_zepp_activity_details_activity ON public.zepp_activity_details(activity_id);

CREATE INDEX IF NOT EXISTS idx_zepp_sleep_user_date ON public.zepp_sleep_summaries(user_id, calendar_date);

CREATE INDEX IF NOT EXISTS idx_zepp_webhook_logs_user ON public.zepp_webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_zepp_webhook_logs_zepp_user ON public.zepp_webhook_logs(zepp_user_id);

-- 3) Triggers for updated_at
CREATE TRIGGER update_zepp_tokens_updated_at
BEFORE UPDATE ON public.zepp_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zepp_activities_updated_at
BEFORE UPDATE ON public.zepp_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zepp_activity_details_updated_at
BEFORE UPDATE ON public.zepp_activity_details
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zepp_sleep_summaries_updated_at
BEFORE UPDATE ON public.zepp_sleep_summaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Set activity_date from start_time when available
CREATE TRIGGER set_zepp_activity_date
BEFORE INSERT OR UPDATE ON public.zepp_activities
FOR EACH ROW EXECUTE FUNCTION public.set_activity_date_from_start_time();

-- 4) Enable RLS
ALTER TABLE public.zepp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zepp_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zepp_activity_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zepp_sleep_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zepp_webhook_logs ENABLE ROW LEVEL SECURITY;

-- 5) Policies
-- zepp_tokens: user-owned, admins can view all
DROP POLICY IF EXISTS "Users can view their own zepp tokens" ON public.zepp_tokens;
DROP POLICY IF EXISTS "Users can insert their own zepp tokens" ON public.zepp_tokens;
DROP POLICY IF EXISTS "Users can update their own zepp tokens" ON public.zepp_tokens;
DROP POLICY IF EXISTS "Users can delete their own zepp tokens" ON public.zepp_tokens;
DROP POLICY IF EXISTS "Admins can view all zepp tokens" ON public.zepp_tokens;

CREATE POLICY "Users can view their own zepp tokens"
ON public.zepp_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own zepp tokens"
ON public.zepp_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zepp tokens"
ON public.zepp_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zepp tokens"
ON public.zepp_tokens FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all zepp tokens"
ON public.zepp_tokens FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- zepp_activities: user-owned CRUD
DROP POLICY IF EXISTS "Users can view their own zepp activities" ON public.zepp_activities;
DROP POLICY IF EXISTS "Users can insert their own zepp activities" ON public.zepp_activities;
DROP POLICY IF EXISTS "Users can update their own zepp activities" ON public.zepp_activities;
DROP POLICY IF EXISTS "Users can delete their own zepp activities" ON public.zepp_activities;

CREATE POLICY "Users can view their own zepp activities"
ON public.zepp_activities FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own zepp activities"
ON public.zepp_activities FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zepp activities"
ON public.zepp_activities FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zepp activities"
ON public.zepp_activities FOR DELETE
USING (auth.uid() = user_id);

-- zepp_activity_details: user-owned CRUD
DROP POLICY IF EXISTS "Users can view their own zepp activity details" ON public.zepp_activity_details;
DROP POLICY IF EXISTS "Users can insert their own zepp activity details" ON public.zepp_activity_details;
DROP POLICY IF EXISTS "Users can update their own zepp activity details" ON public.zepp_activity_details;
DROP POLICY IF EXISTS "Users can delete their own zepp activity details" ON public.zepp_activity_details;

CREATE POLICY "Users can view their own zepp activity details"
ON public.zepp_activity_details FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own zepp activity details"
ON public.zepp_activity_details FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zepp activity details"
ON public.zepp_activity_details FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zepp activity details"
ON public.zepp_activity_details FOR DELETE
USING (auth.uid() = user_id);

-- zepp_sleep_summaries: user-owned SELECT/INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can view their own zepp sleep" ON public.zepp_sleep_summaries;
DROP POLICY IF EXISTS "Users can insert their own zepp sleep" ON public.zepp_sleep_summaries;
DROP POLICY IF EXISTS "Users can update their own zepp sleep" ON public.zepp_sleep_summaries;
DROP POLICY IF EXISTS "Users can delete their own zepp sleep" ON public.zepp_sleep_summaries;

CREATE POLICY "Users can view their own zepp sleep"
ON public.zepp_sleep_summaries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own zepp sleep"
ON public.zepp_sleep_summaries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zepp sleep"
ON public.zepp_sleep_summaries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zepp sleep"
ON public.zepp_sleep_summaries FOR DELETE
USING (auth.uid() = user_id);

-- zepp_webhook_logs: service role manages; users can view their own
DROP POLICY IF EXISTS "Service role can manage zepp webhook logs" ON public.zepp_webhook_logs;
DROP POLICY IF EXISTS "Users can view their own zepp webhook logs" ON public.zepp_webhook_logs;

CREATE POLICY "Service role can manage zepp webhook logs"
ON public.zepp_webhook_logs FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view their own zepp webhook logs"
ON public.zepp_webhook_logs FOR SELECT
USING (auth.uid() = user_id);

-- 6) Helper function: find user by Zepp user id
CREATE OR REPLACE FUNCTION public.find_user_by_zepp_id(zepp_user_id_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  SELECT user_id INTO found_user_id
  FROM public.zepp_tokens
  WHERE zepp_user_id = zepp_user_id_param
    AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;
  RETURN found_user_id;
END;
$$;