
-- Corrigir função/trigger para Zepp GPX usando os nomes corretos de coluna
DROP TRIGGER IF EXISTS trg_all_from_zepp_gpx ON public.zepp_gpx_activities;

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
    v_pace, NEW.elevation_gain_meters, NEW.elevation_loss_meters,
    'zepp_gpx'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_all_from_zepp_gpx
AFTER INSERT ON public.zepp_gpx_activities
FOR EACH ROW EXECUTE FUNCTION public._ins_all_from_zepp_gpx();

-- Refazer somente o backfill da fonte Zepp GPX (idempotente)
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
  zg.elevation_gain_meters,
  zg.elevation_loss_meters,
  'zepp_gpx'
FROM public.zepp_gpx_activities zg
ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
