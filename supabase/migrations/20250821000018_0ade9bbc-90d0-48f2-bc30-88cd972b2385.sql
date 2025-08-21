-- Create trigger to automatically insert training sessions into all_activities
CREATE OR REPLACE FUNCTION public._ins_all_from_training_sessions()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  -- Calculate derived values
  v_minutes := CASE WHEN NEW.total_duration_seconds IS NOT NULL THEN NEW.total_duration_seconds/60.0 ELSE NULL END;
  v_pace := CASE WHEN NEW.total_distance_meters IS NOT NULL AND NEW.total_distance_meters > 0 AND v_minutes IS NOT NULL
           THEN v_minutes / (NEW.total_distance_meters/1000.0) ELSE NULL END;
  v_activity_date := CASE WHEN NEW.started_at IS NOT NULL THEN (NEW.started_at AT TIME ZONE 'UTC')::date ELSE NULL END;

  -- Insert into all_activities table for unified view
  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.id::text, NEW.goal_type, v_activity_date,
    NEW.total_distance_meters, v_minutes,
    'BioPeak AI Coach', NEW.calories_burned,
    NEW.average_heart_rate, NEW.max_heart_rate,
    v_pace, NULL, NULL,
    'biopeak'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$

-- Create trigger for completed training sessions
CREATE OR REPLACE TRIGGER trigger_ins_all_from_training_sessions
  AFTER INSERT OR UPDATE ON public.training_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public._ins_all_from_training_sessions();