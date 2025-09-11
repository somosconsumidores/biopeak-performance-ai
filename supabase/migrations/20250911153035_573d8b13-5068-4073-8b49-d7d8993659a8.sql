-- Fix security issue: add search_path to the healthkit function
CREATE OR REPLACE FUNCTION public._ins_all_from_healthkit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  v_minutes := CASE WHEN NEW.duration_seconds IS NOT NULL THEN NEW.duration_seconds/60.0 ELSE NULL END;
  v_pace := CASE WHEN NEW.distance_meters IS NOT NULL AND NEW.distance_meters > 0 AND v_minutes IS NOT NULL
           THEN v_minutes / (NEW.distance_meters/1000.0) ELSE NULL END;
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
    NEW.user_id, NEW.healthkit_uuid, NEW.activity_type, v_activity_date,
    NEW.distance_meters, v_minutes,
    NEW.device_name, NEW.active_calories,
    NEW.average_heart_rate, NEW.max_heart_rate,
    v_pace, NULL, NULL,
    'healthkit'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
  RETURN NEW;
END;
$function$;