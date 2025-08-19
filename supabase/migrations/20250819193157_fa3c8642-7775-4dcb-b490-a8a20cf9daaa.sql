
-- 1) Tabela unificada
CREATE TABLE IF NOT EXISTS public.all_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  activity_type text,
  activity_date date,
  total_distance_meters double precision,
  total_time_minutes double precision,
  device_name text,
  active_kilocalories double precision,
  average_heart_rate integer,
  max_heart_rate integer,
  pace_min_per_km double precision,
  total_elevation_gain_in_meters double precision,
  total_elevation_loss_in_meters double precision,
  activity_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT all_activities_source_chk
    CHECK (activity_source IN ('garmin','strava','polar','strava_gpx','zepp_gpx','zepp')),
  CONSTRAINT all_activities_unique UNIQUE (user_id, activity_source, activity_id)
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_all_activities_user_date
  ON public.all_activities (user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_all_activities_source
  ON public.all_activities (activity_source);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.all_activities_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_all_activities_set_updated_at ON public.all_activities;
CREATE TRIGGER trg_all_activities_set_updated_at
BEFORE UPDATE ON public.all_activities
FOR EACH ROW EXECUTE FUNCTION public.all_activities_set_updated_at();

-- RLS
ALTER TABLE public.all_activities ENABLE ROW LEVEL SECURITY;

-- Service role pode gerenciar tudo
DROP POLICY IF EXISTS "Service role can manage all_activities" ON public.all_activities;
CREATE POLICY "Service role can manage all_activities"
  ON public.all_activities
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING ((auth.role() = 'service_role'))
  WITH CHECK ((auth.role() = 'service_role'));

-- Usuários podem ver seus próprios registros
DROP POLICY IF EXISTS "Users can view their own all_activities" ON public.all_activities;
CREATE POLICY "Users can view their own all_activities"
  ON public.all_activities
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
  USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios registros (ex.: inserts diretos / triggers)
DROP POLICY IF EXISTS "Users can insert their own all_activities" ON public.all_activities;
CREATE POLICY "Users can insert their own all_activities"
  ON public.all_activities
  AS PERMISSIVE
  FOR INSERT
  TO PUBLIC
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios registros (não é obrigatório, mas útil)
DROP POLICY IF EXISTS "Users can update their own all_activities" ON public.all_activities;
CREATE POLICY "Users can update their own all_activities"
  ON public.all_activities
  AS PERMISSIVE
  FOR UPDATE
  TO PUBLIC
  USING (auth.uid() = user_id);

-- Usuários podem deletar seus próprios registros (opcional)
DROP POLICY IF EXISTS "Users can delete their own all_activities" ON public.all_activities;
CREATE POLICY "Users can delete their own all_activities"
  ON public.all_activities
  AS PERMISSIVE
  FOR DELETE
  TO PUBLIC
  USING (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 2) Funções e triggers por origem
--------------------------------------------------------------------------------

-- Garmin
CREATE OR REPLACE FUNCTION public._ins_all_from_garmin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutes double precision;
  v_pace double precision;
BEGIN
  v_minutes := CASE 
    WHEN NEW.duration_in_seconds IS NOT NULL THEN NEW.duration_in_seconds / 60.0 
    ELSE NULL 
  END;

  v_pace := CASE 
    WHEN NEW.distance_in_meters IS NOT NULL AND NEW.distance_in_meters > 0 AND v_minutes IS NOT NULL
      THEN v_minutes / (NEW.distance_in_meters / 1000.0)
    ELSE NULL
  END;

  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.activity_id, NEW.activity_type, NEW.activity_date,
    NEW.distance_in_meters, v_minutes,
    NEW.device_name, NEW.active_kilocalories,
    NEW.average_heart_rate_in_beats_per_minute, NEW.max_heart_rate_in_beats_per_minute,
    COALESCE(NEW.average_pace_in_minutes_per_kilometer, v_pace),
    NEW.total_elevation_gain_in_meters, NEW.total_elevation_loss_in_meters,
    'garmin'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_all_from_garmin ON public.garmin_activities;
CREATE TRIGGER trg_all_from_garmin
AFTER INSERT ON public.garmin_activities
FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_garmin();

-- Strava
CREATE OR REPLACE FUNCTION public._ins_all_from_strava()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_avg_hr integer;
  v_max_hr integer;
  v_activity_date date;
BEGIN
  v_minutes := CASE WHEN NEW.moving_time IS NOT NULL THEN NEW.moving_time / 60.0 ELSE NULL END;

  v_pace := CASE 
    WHEN NEW.distance IS NOT NULL AND NEW.distance > 0 AND v_minutes IS NOT NULL
      THEN v_minutes / (NEW.distance / 1000.0)
    ELSE NULL
  END;

  v_avg_hr := CASE WHEN NEW.average_heartrate IS NOT NULL THEN ROUND(NEW.average_heartrate)::int ELSE NULL END;
  v_max_hr := CASE WHEN NEW.max_heartrate IS NOT NULL THEN ROUND(NEW.max_heartrate)::int ELSE NULL END;

  v_activity_date := CASE WHEN NEW.start_date IS NOT NULL THEN (NEW.start_date AT TIME ZONE 'UTC')::date ELSE NULL END;

  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.strava_activity_id::text, NEW.type, v_activity_date,
    NEW.distance, v_minutes,
    NULL, NEW.calories,
    v_avg_hr, v_max_hr,
    v_pace, NEW.total_elevation_gain, NULL,
    'strava'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_all_from_strava ON public.strava_activities;
CREATE TRIGGER trg_all_from_strava
AFTER INSERT ON public.strava_activities
FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_strava();

-- Strava GPX
CREATE OR REPLACE FUNCTION public._ins_all_from_strava_gpx()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  v_minutes := CASE WHEN NEW.duration_in_seconds IS NOT NULL THEN NEW.duration_in_seconds / 60.0 ELSE NULL END;

  v_pace := CASE 
    WHEN NEW.distance_in_meters IS NOT NULL AND NEW.distance_in_meters > 0 AND v_minutes IS NOT NULL
      THEN v_minutes / (NEW.distance_in_meters / 1000.0)
    ELSE NULL
  END;

  v_activity_date := CASE WHEN NEW.start_time IS NOT NULL THEN (NEW.start_time AT TIME ZONE 'UTC')::date ELSE NULL END;

  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.activity_id, NEW.activity_type, v_activity_date,
    NEW.distance_in_meters, v_minutes,
    NULL, NEW.calories,
    NEW.average_heart_rate, NEW.max_heart_rate,
    v_pace, NEW.total_elevation_gain_in_meters, NEW.total_elevation_loss_in_meters,
    'strava_gpx'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_all_from_strava_gpx ON public.strava_gpx_activities;
CREATE TRIGGER trg_all_from_strava_gpx
AFTER INSERT ON public.strava_gpx_activities
FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_strava_gpx();

-- Zepp GPX
CREATE OR REPLACE FUNCTION public._ins_all_from_zepp_gpx()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  v_minutes := CASE WHEN NEW.duration_in_seconds IS NOT NULL THEN NEW.duration_in_seconds / 60.0 ELSE NULL END;

  v_pace := CASE 
    WHEN NEW.distance_in_meters IS NOT NULL AND NEW.distance_in_meters > 0 AND v_minutes IS NOT NULL
      THEN v_minutes / (NEW.distance_in_meters / 1000.0)
    ELSE NULL
  END;

  v_activity_date := CASE WHEN NEW.start_time IS NOT NULL THEN (NEW.start_time AT TIME ZONE 'UTC')::date ELSE NULL END;

  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.activity_id, NEW.activity_type, v_activity_date,
    NEW.distance_in_meters, v_minutes,
    NULL, NEW.calories,
    NEW.average_heart_rate, NEW.max_heart_rate,
    v_pace, NEW.total_elevation_gain_in_meters, NEW.total_elevation_loss_in_meters,
    'zepp_gpx'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_all_from_zepp_gpx ON public.zepp_gpx_activities;
CREATE TRIGGER trg_all_from_zepp_gpx
AFTER INSERT ON public.zepp_gpx_activities
FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_zepp_gpx();

-- Zepp (API)
CREATE OR REPLACE FUNCTION public._ins_all_from_zepp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  v_minutes := CASE WHEN NEW.duration_in_seconds IS NOT NULL THEN NEW.duration_in_seconds / 60.0 ELSE NULL END;

  v_pace := CASE 
    WHEN NEW.distance_in_meters IS NOT NULL AND NEW.distance_in_meters > 0 AND v_minutes IS NOT NULL
      THEN v_minutes / (NEW.distance_in_meters / 1000.0)
    ELSE NULL
  END;

  v_activity_date := CASE WHEN NEW.start_time IS NOT NULL THEN (NEW.start_time AT TIME ZONE 'UTC')::date ELSE NULL END;

  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.activity_id, NEW.activity_type, v_activity_date,
    NEW.distance_in_meters, v_minutes,
    NEW.device_name, NEW.calories,
    NEW.average_heart_rate_bpm, NEW.max_heart_rate_bpm,
    v_pace, NULL, NULL,
    'zepp'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_all_from_zepp ON public.zepp_activities;
CREATE TRIGGER trg_all_from_zepp
AFTER INSERT ON public.zepp_activities
FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_zepp();

-- Polar
CREATE OR REPLACE FUNCTION public._ins_all_from_polar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_seconds double precision;
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  -- Duração no Polar vem como texto ISO 8601 (ex.: 'PT54.649S'); convertemos para segundos
  v_seconds := CASE 
    WHEN NEW.duration IS NOT NULL AND NEW.duration <> '' 
      THEN EXTRACT(EPOCH FROM (NEW.duration::interval))
    ELSE NULL 
  END;

  v_minutes := CASE WHEN v_seconds IS NOT NULL THEN v_seconds / 60.0 ELSE NULL END;

  v_pace := CASE 
    WHEN NEW.distance IS NOT NULL AND NEW.distance > 0 AND v_minutes IS NOT NULL
      THEN v_minutes / (NEW.distance / 1000.0)
    ELSE NULL
  END;

  v_activity_date := CASE WHEN NEW.start_time IS NOT NULL THEN (NEW.start_time AT TIME ZONE 'UTC')::date ELSE NULL END;

  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.activity_id, NEW.activity_type, v_activity_date,
    NEW.distance, v_minutes,
    NEW.device, NEW.calories,
    NEW.average_heart_rate_bpm, NEW.maximum_heart_rate_bpm,
    v_pace, NULL, NULL,
    'polar'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_all_from_polar ON public.polar_activities;
CREATE TRIGGER trg_all_from_polar
AFTER INSERT ON public.polar_activities
FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_polar();

--------------------------------------------------------------------------------
-- 3) Backfill único (histórico atual)
--------------------------------------------------------------------------------

-- Garmin
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes,
  device_name, active_kilocalories,
  average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  g.user_id,
  g.activity_id,
  g.activity_type,
  g.activity_date,
  g.distance_in_meters,
  CASE WHEN g.duration_in_seconds IS NOT NULL THEN g.duration_in_seconds/60.0 ELSE NULL END,
  g.device_name,
  g.active_kilocalories,
  g.average_heart_rate_in_beats_per_minute,
  g.max_heart_rate_in_beats_per_minute,
  COALESCE(g.average_pace_in_minutes_per_kilometer,
           CASE WHEN g.distance_in_meters > 0 AND g.duration_in_seconds IS NOT NULL 
                THEN (g.duration_in_seconds/60.0) / (g.distance_in_meters/1000.0) 
                ELSE NULL END),
  g.total_elevation_gain_in_meters,
  g.total_elevation_loss_in_meters,
  'garmin'
FROM public.garmin_activities g
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Strava
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes,
  device_name, active_kilocalories,
  average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  s.user_id,
  s.strava_activity_id::text,
  s.type,
  CASE WHEN s.start_date IS NOT NULL THEN (s.start_date AT TIME ZONE 'UTC')::date ELSE NULL END,
  s.distance,
  CASE WHEN s.moving_time IS NOT NULL THEN s.moving_time/60.0 ELSE NULL END,
  NULL,
  s.calories,
  CASE WHEN s.average_heartrate IS NOT NULL THEN ROUND(s.average_heartrate)::int ELSE NULL END,
  CASE WHEN s.max_heartrate IS NOT NULL THEN ROUND(s.max_heartrate)::int ELSE NULL END,
  CASE WHEN s.distance IS NOT NULL AND s.distance > 0 AND s.moving_time IS NOT NULL 
       THEN (s.moving_time/60.0) / (s.distance/1000.0) 
       ELSE NULL END,
  s.total_elevation_gain,
  NULL,
  'strava'
FROM public.strava_activities s
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Strava GPX
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes,
  device_name, active_kilocalories,
  average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  sg.user_id,
  sg.activity_id,
  sg.activity_type,
  CASE WHEN sg.start_time IS NOT NULL THEN (sg.start_time AT TIME ZONE 'UTC')::date ELSE NULL END,
  sg.distance_in_meters,
  CASE WHEN sg.duration_in_seconds IS NOT NULL THEN sg.duration_in_seconds/60.0 ELSE NULL END,
  NULL,
  sg.calories,
  sg.average_heart_rate,
  sg.max_heart_rate,
  CASE WHEN sg.distance_in_meters IS NOT NULL AND sg.distance_in_meters > 0 AND sg.duration_in_seconds IS NOT NULL
       THEN (sg.duration_in_seconds/60.0) / (sg.distance_in_meters/1000.0)
       ELSE NULL END,
  sg.total_elevation_gain_in_meters,
  sg.total_elevation_loss_in_meters,
  'strava_gpx'
FROM public.strava_gpx_activities sg
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Zepp GPX
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes,
  device_name, active_kilocalories,
  average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  zg.user_id,
  zg.activity_id,
  zg.activity_type,
  CASE WHEN zg.start_time IS NOT NULL THEN (zg.start_time AT TIME ZONE 'UTC')::date ELSE NULL END,
  zg.distance_in_meters,
  CASE WHEN zg.duration_in_seconds IS NOT NULL THEN zg.duration_in_seconds/60.0 ELSE NULL END,
  NULL,
  zg.calories,
  zg.average_heart_rate,
  zg.max_heart_rate,
  CASE WHEN zg.distance_in_meters IS NOT NULL AND zg.distance_in_meters > 0 AND zg.duration_in_seconds IS NOT NULL
       THEN (zg.duration_in_seconds/60.0) / (zg.distance_in_meters/1000.0)
       ELSE NULL END,
  zg.total_elevation_gain_in_meters,
  zg.total_elevation_loss_in_meters,
  'zepp_gpx'
FROM public.zepp_gpx_activities zg
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Zepp
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes,
  device_name, active_kilocalories,
  average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  z.user_id,
  z.activity_id,
  z.activity_type,
  CASE WHEN z.start_time IS NOT NULL THEN (z.start_time AT TIME ZONE 'UTC')::date ELSE NULL END,
  z.distance_in_meters,
  CASE WHEN z.duration_in_seconds IS NOT NULL THEN z.duration_in_seconds/60.0 ELSE NULL END,
  z.device_name,
  z.calories,
  z.average_heart_rate_bpm,
  z.max_heart_rate_bpm,
  CASE WHEN z.distance_in_meters IS NOT NULL AND z.distance_in_meters > 0 AND z.duration_in_seconds IS NOT NULL
       THEN (z.duration_in_seconds/60.0) / (z.distance_in_meters/1000.0)
       ELSE NULL END,
  NULL,
  NULL,
  'zepp'
FROM public.zepp_activities z
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Polar
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes,
  device_name, active_kilocalories,
  average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  p.user_id,
  p.activity_id,
  p.activity_type,
  CASE WHEN p.start_time IS NOT NULL THEN (p.start_time AT TIME ZONE 'UTC')::date ELSE NULL END,
  p.distance,
  CASE 
    WHEN p.duration IS NOT NULL AND p.duration <> '' 
      THEN EXTRACT(EPOCH FROM (p.duration::interval)) / 60.0
    ELSE NULL
  END,
  p.device,
  p.calories,
  p.average_heart_rate_bpm,
  p.maximum_heart_rate_bpm,
  CASE 
    WHEN p.distance IS NOT NULL AND p.distance > 0 AND p.duration IS NOT NULL AND p.duration <> '' 
      THEN (EXTRACT(EPOCH FROM (p.duration::interval)) / 60.0) / (p.distance / 1000.0)
    ELSE NULL
  END,
  NULL,
  NULL,
  'polar'
FROM public.polar_activities p
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
