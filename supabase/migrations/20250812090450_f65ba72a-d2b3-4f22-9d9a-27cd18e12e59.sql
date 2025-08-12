-- 1) Tabelas para importação GPX do Strava
-- ======================================

-- Tabela de atividades (resumo)
CREATE TABLE IF NOT EXISTS public.strava_gpx_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  source TEXT NOT NULL DEFAULT 'strava_gpx',
  name TEXT,
  activity_type TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_in_seconds INTEGER,
  distance_in_meters DOUBLE PRECISION,
  average_heart_rate INTEGER,
  max_heart_rate INTEGER,
  total_elevation_gain_in_meters DOUBLE PRECISION,
  total_elevation_loss_in_meters DOUBLE PRECISION,
  calories INTEGER,
  average_speed_in_meters_per_second DOUBLE PRECISION,
  average_pace_in_minutes_per_kilometer DOUBLE PRECISION,
  activity_date DATE,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_strava_gpx_activities_user_date
  ON public.strava_gpx_activities(user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_strava_gpx_activities_user_start
  ON public.strava_gpx_activities(user_id, start_time DESC);

-- Função/trigger para popular activity_date a partir de start_time
CREATE OR REPLACE FUNCTION public.set_activity_date_from_start_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.activity_date := CASE
    WHEN NEW.start_time IS NOT NULL THEN (NEW.start_time AT TIME ZONE 'UTC')::date
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_activity_date_strava_gpx ON public.strava_gpx_activities;
CREATE TRIGGER trg_set_activity_date_strava_gpx
BEFORE INSERT OR UPDATE OF start_time ON public.strava_gpx_activities
FOR EACH ROW
EXECUTE FUNCTION public.set_activity_date_from_start_time();

-- RLS
ALTER TABLE public.strava_gpx_activities ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Users can view their own strava gpx activities'
  ) THEN
    CREATE POLICY "Users can view their own strava gpx activities"
    ON public.strava_gpx_activities
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Users can insert their own strava gpx activities'
  ) THEN
    CREATE POLICY "Users can insert their own strava gpx activities"
    ON public.strava_gpx_activities
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Users can update their own strava gpx activities'
  ) THEN
    CREATE POLICY "Users can update their own strava gpx activities"
    ON public.strava_gpx_activities
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Users can delete their own strava gpx activities'
  ) THEN
    CREATE POLICY "Users can delete their own strava gpx activities"
    ON public.strava_gpx_activities
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activities' AND policyname = 'Admins can view all strava gpx activities'
  ) THEN
    CREATE POLICY "Admins can view all strava gpx activities"
    ON public.strava_gpx_activities
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Tabela de detalhes (amostras agregadas em JSON)
CREATE TABLE IF NOT EXISTS public.strava_gpx_activity_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  activity_name TEXT,
  device_name TEXT,
  start_time TIMESTAMPTZ,
  duration_in_seconds INTEGER,
  total_distance_in_meters DOUBLE PRECISION,
  samples JSONB,
  activity_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strava_gpx_details_user_activity
  ON public.strava_gpx_activity_details(user_id, activity_id);

ALTER TABLE public.strava_gpx_activity_details ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activity_details' AND policyname = 'Users can view their own strava gpx activity details'
  ) THEN
    CREATE POLICY "Users can view their own strava gpx activity details"
    ON public.strava_gpx_activity_details
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activity_details' AND policyname = 'Users can insert their own strava gpx activity details'
  ) THEN
    CREATE POLICY "Users can insert their own strava gpx activity details"
    ON public.strava_gpx_activity_details
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activity_details' AND policyname = 'Users can update their own strava gpx activity details'
  ) THEN
    CREATE POLICY "Users can update their own strava gpx activity details"
    ON public.strava_gpx_activity_details
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strava_gpx_activity_details' AND policyname = 'Users can delete their own strava gpx activity details'
  ) THEN
    CREATE POLICY "Users can delete their own strava gpx activity details"
    ON public.strava_gpx_activity_details
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Bucket de Storage para arquivos GPX
-- ======================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('gpx', 'gpx', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage (um diretório por usuário: <user_id>/arquivo.gpx)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can read their own GPX files'
  ) THEN
    CREATE POLICY "Users can read their own GPX files"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'gpx'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own GPX files'
  ) THEN
    CREATE POLICY "Users can upload their own GPX files"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'gpx'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own GPX files'
  ) THEN
    CREATE POLICY "Users can update their own GPX files"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'gpx'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own GPX files'
  ) THEN
    CREATE POLICY "Users can delete their own GPX files"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'gpx'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;