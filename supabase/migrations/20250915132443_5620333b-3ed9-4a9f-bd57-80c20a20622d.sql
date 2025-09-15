-- Create trigger function to populate all_activities from healthkit_activities
CREATE OR REPLACE FUNCTION public._ins_all_from_healthkit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_minutes double precision;
  v_pace double precision;
BEGIN
  v_minutes := CASE WHEN NEW.duration_seconds IS NOT NULL THEN NEW.duration_seconds/60.0 ELSE NULL END;
  v_pace := NEW.pace_min_per_km;

  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.healthkit_uuid, NEW.activity_type, NEW.activity_date,
    NEW.distance_meters, v_minutes,
    NEW.device_name, NEW.active_calories,
    NEW.average_heart_rate, NEW.max_heart_rate,
    v_pace, NEW.elevation_gain_meters, NEW.elevation_loss_meters,
    'healthkit'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Create trigger to populate all_activities after healthkit_activities insert
CREATE OR REPLACE TRIGGER trg_ins_all_from_healthkit
AFTER INSERT ON public.healthkit_activities
FOR EACH ROW
EXECUTE FUNCTION public._ins_all_from_healthkit();

-- Create trigger to process chart data for healthkit activities
CREATE OR REPLACE FUNCTION public.trg_process_chart_after_insert_healthkit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/calculate-activity-chart-data',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'activity_id', NEW.healthkit_uuid,
      'activity_source', 'healthkit'
    )
  );
  RETURN NEW;
END;
$function$;

-- Create trigger for chart processing
CREATE OR REPLACE TRIGGER trg_process_chart_after_insert_healthkit
AFTER INSERT ON public.healthkit_activities
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_chart_after_insert_healthkit();