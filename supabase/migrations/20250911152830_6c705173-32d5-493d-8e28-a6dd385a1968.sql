-- Create function to automatically insert HealthKit activities into all_activities table
CREATE OR REPLACE FUNCTION public._ins_all_from_healthkit()
 RETURNS trigger
 LANGUAGE plpgsql
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
$function$

-- Create trigger to automatically populate all_activities when healthkit_activities is updated
DROP TRIGGER IF EXISTS trigger_ins_all_from_healthkit ON public.healthkit_activities;
CREATE TRIGGER trigger_ins_all_from_healthkit
    AFTER INSERT OR UPDATE ON public.healthkit_activities
    FOR EACH ROW
    EXECUTE FUNCTION public._ins_all_from_healthkit();

-- Create trigger to automatically calculate variation analysis for HealthKit activities
CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc_healthkit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.calculate_variation_analysis(NEW.user_id, 'healthkit', NEW.healthkit_uuid::text);
  RETURN NEW;
END;
$function$

DROP TRIGGER IF EXISTS trigger_variation_analysis_healthkit ON public.activity_chart_cache;
CREATE TRIGGER trigger_variation_analysis_healthkit
    AFTER INSERT OR UPDATE ON public.activity_chart_cache
    FOR EACH ROW
    WHEN (NEW.activity_source = 'healthkit')
    EXECUTE FUNCTION public.trg_variation_analysis_recalc_healthkit();

-- Create trigger to automatically process chart data for HealthKit activities
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
$function$

DROP TRIGGER IF EXISTS trigger_process_chart_healthkit ON public.healthkit_activities;
CREATE TRIGGER trigger_process_chart_healthkit
    AFTER INSERT OR UPDATE ON public.healthkit_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_process_chart_after_insert_healthkit();