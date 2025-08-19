
-- 1) Índice único para garantir idempotência nos inserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_all_activities_unique
  ON public.all_activities (user_id, activity_source, activity_id);

-- 2) Recriar triggers (drop se existirem, depois create) para cada fonte

-- Garmin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_all_from_garmin') THEN
    DROP TRIGGER trg_all_from_garmin ON public.garmin_activities;
  END IF;
  CREATE TRIGGER trg_all_from_garmin
    AFTER INSERT ON public.garmin_activities
    FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_garmin();
END$$;

-- Strava (API)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_all_from_strava') THEN
    DROP TRIGGER trg_all_from_strava ON public.strava_activities;
  END IF;
  CREATE TRIGGER trg_all_from_strava
    AFTER INSERT ON public.strava_activities
    FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_strava();
END$$;

-- Strava GPX (importado)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_all_from_strava_gpx') THEN
    DROP TRIGGER trg_all_from_strava_gpx ON public.strava_gpx_activities;
  END IF;
  CREATE TRIGGER trg_all_from_strava_gpx
    AFTER INSERT ON public.strava_gpx_activities
    FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_strava_gpx();
END$$;

-- Zepp GPX (importado)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_all_from_zepp_gpx') THEN
    DROP TRIGGER trg_all_from_zepp_gpx ON public.zepp_gpx_activities;
  END IF;
  CREATE TRIGGER trg_all_from_zepp_gpx
    AFTER INSERT ON public.zepp_gpx_activities
    FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_zepp_gpx();
END$$;

-- Zepp (API)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_all_from_zepp') THEN
    DROP TRIGGER trg_all_from_zepp ON public.zepp_activities;
  END IF;
  CREATE TRIGGER trg_all_from_zepp
    AFTER INSERT ON public.zepp_activities
    FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_zepp();
END$$;

-- Polar
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_all_from_polar') THEN
    DROP TRIGGER trg_all_from_polar ON public.polar_activities;
  END IF;
  CREATE TRIGGER trg_all_from_polar
    AFTER INSERT ON public.polar_activities
    FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_polar();
END$$;

-- 3) Backfill idempotente de todo o histórico (ON CONFLICT DO NOTHING)

-- Garmin
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes, device_name,
  active_kilocalories, average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  ga.user_id,
  ga.activity_id,
  ga.activity_type,
  ga.activity_date,
  ga.distance_in_meters,
  CASE WHEN ga.duration_in_seconds IS NOT NULL THEN ga.duration_in_seconds/60.0 ELSE NULL END,
  ga.device_name,
  ga.active_kilocalories,
  ga.average_heart_rate_in_beats_per_minute,
  ga.max_heart_rate_in_beats_per_minute,
  CASE 
    WHEN ga.distance_in_meters IS NOT NULL AND ga.distance_in_meters > 0 AND ga.duration_in_seconds IS NOT NULL
      THEN (ga.duration_in_seconds/60.0) / (ga.distance_in_meters/1000.0)
    ELSE NULL
  END,
  ga.total_elevation_gain_in_meters,
  ga.total_elevation_loss_in_meters,
  'garmin'
FROM public.garmin_activities ga
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Strava (API)
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes, device_name,
  active_kilocalories, average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  sa.user_id,
  sa.strava_activity_id::text AS activity_id,
  sa.type AS activity_type,
  (sa.start_date AT TIME ZONE 'UTC')::date AS activity_date,
  sa.distance,
  CASE WHEN sa.moving_time IS NOT NULL THEN sa.moving_time/60.0 ELSE NULL END,
  NULL AS device_name,
  sa.calories,
  sa.average_heartrate,
  sa.max_heartrate,
  CASE 
    WHEN sa.distance IS NOT NULL AND sa.distance > 0 AND sa.moving_time IS NOT NULL
      THEN (sa.moving_time/60.0) / (sa.distance/1000.0)
    ELSE NULL
  END,
  sa.total_elevation_gain,
  NULL AS total_elevation_loss_in_meters,
  'strava'
FROM public.strava_activities sa
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Strava GPX (importado)
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes, device_name,
  active_kilocalories, average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  sx.user_id,
  sx.activity_id,
  sx.activity_type,
  (sx.start_time AT TIME ZONE 'UTC')::date AS activity_date,
  sx.distance_in_meters,
  CASE WHEN sx.duration_in_seconds IS NOT NULL THEN sx.duration_in_seconds/60.0 ELSE NULL END,
  NULL AS device_name,
  sx.calories,
  sx.average_heart_rate,
  sx.max_heart_rate,
  CASE 
    WHEN sx.distance_in_meters IS NOT NULL AND sx.distance_in_meters > 0 AND sx.duration_in_seconds IS NOT NULL
      THEN (sx.duration_in_seconds/60.0) / (sx.distance_in_meters/1000.0)
    ELSE NULL
  END,
  sx.total_elevation_gain_in_meters,
  sx.total_elevation_loss_in_meters,
  'strava_gpx'
FROM public.strava_gpx_activities sx
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Zepp GPX (importado)
-- Observação: as colunas são elevation_gain_meters / elevation_loss_meters
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes, device_name,
  active_kilocalories, average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  zx.user_id,
  zx.activity_id,
  zx.activity_type,
  (zx.start_time AT TIME ZONE 'UTC')::date AS activity_date,
  zx.distance_in_meters,
  CASE WHEN zx.duration_in_seconds IS NOT NULL THEN zx.duration_in_seconds/60.0 ELSE NULL END,
  NULL AS device_name,
  zx.calories,
  zx.average_heart_rate,
  zx.max_heart_rate,
  CASE 
    WHEN zx.distance_in_meters IS NOT NULL AND zx.distance_in_meters > 0 AND zx.duration_in_seconds IS NOT NULL
      THEN (zx.duration_in_seconds/60.0) / (zx.distance_in_meters/1000.0)
    ELSE NULL
  END,
  zx.elevation_gain_meters,
  zx.elevation_loss_meters,
  'zepp_gpx'
FROM public.zepp_gpx_activities zx
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Zepp (API)
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes, device_name,
  active_kilocalories, average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  za.user_id,
  za.activity_id,
  za.activity_type,
  (za.start_time AT TIME ZONE 'UTC')::date AS activity_date,
  za.distance_in_meters,
  CASE WHEN za.duration_in_seconds IS NOT NULL THEN za.duration_in_seconds/60.0 ELSE NULL END,
  za.device_name,
  za.calories,
  za.average_heart_rate_bpm,
  za.max_heart_rate_bpm,
  CASE 
    WHEN za.distance_in_meters IS NOT NULL AND za.distance_in_meters > 0 AND za.duration_in_seconds IS NOT NULL
      THEN (za.duration_in_seconds/60.0) / (za.distance_in_meters/1000.0)
    ELSE NULL
  END,
  NULL, -- ganho não existe
  NULL, -- perda não existe
  'zepp'
FROM public.zepp_activities za
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

-- Polar
-- Duração pode vir em formatos diferentes; abaixo tentamos interpretar:
INSERT INTO public.all_activities (
  user_id, activity_id, activity_type, activity_date,
  total_distance_meters, total_time_minutes, device_name,
  active_kilocalories, average_heart_rate, max_heart_rate,
  pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
  activity_source
)
SELECT
  pa.user_id,
  pa.activity_id,
  pa.activity_type,
  (pa.start_time AT TIME ZONE 'UTC')::date AS activity_date,
  pa.distance,
  CASE 
    WHEN pa.duration IS NULL THEN NULL
    WHEN pa.duration::text ~ '^[0-9]+(\\.[0-9]+)?$' THEN (pa.duration::text)::double precision / 60.0
    ELSE EXTRACT(epoch FROM (pa.duration::text)::interval)/60.0
  END AS total_time_minutes,
  pa.device,
  pa.calories,
  pa.average_heart_rate_bpm,
  pa.maximum_heart_rate_bpm,
  CASE 
    WHEN pa.distance IS NOT NULL AND pa.distance > 0 THEN
      CASE 
        WHEN pa.duration IS NULL THEN NULL
        WHEN pa.duration::text ~ '^[0-9]+(\\.[0-9]+)?$' THEN ((pa.duration::text)::double precision/60.0) / (pa.distance/1000.0)
        ELSE (EXTRACT(epoch FROM (pa.duration::text)::interval)/60.0) / (pa.distance/1000.0)
      END
    ELSE NULL
  END AS pace_min_per_km,
  NULL, -- ganho não disponível
  NULL, -- perda não disponível
  'polar'
FROM public.polar_activities pa
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
