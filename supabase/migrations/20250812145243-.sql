-- Fix: use correct column name policyname in pg_policies checks
-- Storage policies for 'gpx' bucket (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'GPX owners can read their files'
  ) THEN
    CREATE POLICY "GPX owners can read their files"
      ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'GPX owners can upload files'
  ) THEN
    CREATE POLICY "GPX owners can upload files"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'GPX owners can update files'
  ) THEN
    CREATE POLICY "GPX owners can update files"
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'GPX owners can delete files'
  ) THEN
    CREATE POLICY "GPX owners can delete files"
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'gpx' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- Ensure GPX tables exist and have RLS and policies (idempotent)
CREATE TABLE IF NOT EXISTS public.strava_gpx_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  name text,
  activity_type text,
  start_time timestamptz,
  distance_in_meters double precision,
  duration_in_seconds integer,
  total_elevation_gain_in_meters double precision,
  total_elevation_loss_in_meters double precision,
  average_heart_rate integer,
  max_heart_rate integer,
  average_speed_mps double precision,
  average_pace_min_km numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gpx_activities_user_activity
  ON public.strava_gpx_activities(user_id, activity_id);

ALTER TABLE public.strava_gpx_activities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Users can view their own gpx activities'
  ) THEN
    CREATE POLICY "Users can view their own gpx activities"
      ON public.strava_gpx_activities
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Users can insert their own gpx activities'
  ) THEN
    CREATE POLICY "Users can insert their own gpx activities"
      ON public.strava_gpx_activities
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Users can update their own gpx activities'
  ) THEN
    CREATE POLICY "Users can update their own gpx activities"
      ON public.strava_gpx_activities
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Users can delete their own gpx activities'
  ) THEN
    CREATE POLICY "Users can delete their own gpx activities"
      ON public.strava_gpx_activities
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.strava_gpx_activity_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  sample_timestamp timestamptz,
  latitude_in_degree double precision,
  longitude_in_degree double precision,
  elevation_in_meters double precision,
  heart_rate integer,
  total_distance_in_meters double precision,
  speed_meters_per_second double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gpx_details_activity ON public.strava_gpx_activity_details(activity_id);
CREATE INDEX IF NOT EXISTS idx_gpx_details_user_activity ON public.strava_gpx_activity_details(user_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_gpx_details_timestamp ON public.strava_gpx_activity_details(sample_timestamp);

ALTER TABLE public.strava_gpx_activity_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_gpx_activity_details' AND policyname = 'Users can view their own gpx details'
  ) THEN
    CREATE POLICY "Users can view their own gpx details"
      ON public.strava_gpx_activity_details
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_gpx_activity_details' AND policyname = 'Users can insert their own gpx details'
  ) THEN
    CREATE POLICY "Users can insert their own gpx details"
      ON public.strava_gpx_activity_details
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_gpx_activity_details' AND policyname = 'Users can update their own gpx details'
  ) THEN
    CREATE POLICY "Users can update their own gpx details"
      ON public.strava_gpx_activity_details
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_gpx_activity_details' AND policyname = 'Users can delete their own gpx details'
  ) THEN
    CREATE POLICY "Users can delete their own gpx details"
      ON public.strava_gpx_activity_details
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;