-- Patch migration for GPX: ensure table structures exist before creating indexes

-- 1) Ensure summary table exists with required columns
CREATE TABLE IF NOT EXISTS public.strava_gpx_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  name TEXT,
  activity_type TEXT,
  start_time TIMESTAMPTZ,
  distance_in_meters DOUBLE PRECISION,
  duration_in_seconds INTEGER,
  elevation_gain_in_meters DOUBLE PRECISION,
  elevation_loss_in_meters DOUBLE PRECISION,
  average_heart_rate_bpm INTEGER,
  max_heart_rate_bpm INTEGER,
  average_speed_in_meters_per_second DOUBLE PRECISION,
  average_pace_in_minutes_per_kilometer DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'strava_gpx',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure essential columns exist (in case the table pre-existed)
ALTER TABLE public.strava_gpx_activities 
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_strava_gpx_activities_user_activity_id'
  ) THEN
    CREATE UNIQUE INDEX idx_strava_gpx_activities_user_activity_id 
      ON public.strava_gpx_activities(user_id, activity_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_strava_gpx_activities_user_start_time'
  ) THEN
    CREATE INDEX idx_strava_gpx_activities_user_start_time 
      ON public.strava_gpx_activities(user_id, start_time DESC);
  END IF;
END $$;

ALTER TABLE public.strava_gpx_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own strava gpx activities" ON public.strava_gpx_activities;
DROP POLICY IF EXISTS "Users can insert their own strava gpx activities" ON public.strava_gpx_activities;
DROP POLICY IF EXISTS "Users can update their own strava gpx activities" ON public.strava_gpx_activities;
DROP POLICY IF EXISTS "Users can delete their own strava gpx activities" ON public.strava_gpx_activities;

CREATE POLICY "Users can view their own strava gpx activities"
ON public.strava_gpx_activities
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strava gpx activities"
ON public.strava_gpx_activities
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strava gpx activities"
ON public.strava_gpx_activities
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strava gpx activities"
ON public.strava_gpx_activities
FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_strava_gpx_activities_updated_at ON public.strava_gpx_activities;
CREATE TRIGGER update_strava_gpx_activities_updated_at
BEFORE UPDATE ON public.strava_gpx_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Ensure details table exists with required columns
CREATE TABLE IF NOT EXISTS public.strava_gpx_activity_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  sample_timestamp TIMESTAMPTZ,
  heart_rate INTEGER,
  latitude_in_degree DOUBLE PRECISION,
  longitude_in_degree DOUBLE PRECISION,
  elevation_in_meters DOUBLE PRECISION,
  total_distance_in_meters DOUBLE PRECISION,
  speed_meters_per_second DOUBLE PRECISION,
  activity_summary JSONB,
  samples JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns if table already existed
ALTER TABLE public.strava_gpx_activity_details 
  ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS activity_id TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS sample_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heart_rate INTEGER,
  ADD COLUMN IF NOT EXISTS latitude_in_degree DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude_in_degree DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS elevation_in_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS total_distance_in_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS speed_meters_per_second DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS activity_summary JSONB,
  ADD COLUMN IF NOT EXISTS samples JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_strava_gpx_activity_details_user_activity'
  ) THEN
    CREATE INDEX idx_strava_gpx_activity_details_user_activity 
      ON public.strava_gpx_activity_details(user_id, activity_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_strava_gpx_activity_details_timestamp'
  ) THEN
    CREATE INDEX idx_strava_gpx_activity_details_timestamp 
      ON public.strava_gpx_activity_details(sample_timestamp);
  END IF;
END $$;

ALTER TABLE public.strava_gpx_activity_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own strava gpx activity details" ON public.strava_gpx_activity_details;
DROP POLICY IF EXISTS "Users can insert their own strava gpx activity details" ON public.strava_gpx_activity_details;
DROP POLICY IF EXISTS "Users can update their own strava gpx activity details" ON public.strava_gpx_activity_details;
DROP POLICY IF EXISTS "Users can delete their own strava gpx activity details" ON public.strava_gpx_activity_details;

CREATE POLICY "Users can view their own strava gpx activity details"
ON public.strava_gpx_activity_details
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strava gpx activity details"
ON public.strava_gpx_activity_details
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strava gpx activity details"
ON public.strava_gpx_activity_details
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strava gpx activity details"
ON public.strava_gpx_activity_details
FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_strava_gpx_activity_details_updated_at ON public.strava_gpx_activity_details;
CREATE TRIGGER update_strava_gpx_activity_details_updated_at
BEFORE UPDATE ON public.strava_gpx_activity_details
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Storage policies for GPX uploads (idempotent checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can read their own gpx files'
  ) THEN
    CREATE POLICY "Users can read their own gpx files"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own gpx files'
  ) THEN
    CREATE POLICY "Users can upload their own gpx files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own gpx files'
  ) THEN
    CREATE POLICY "Users can update their own gpx files"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1])
    WITH CHECK (bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own gpx files'
  ) THEN
    CREATE POLICY "Users can delete their own gpx files"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
