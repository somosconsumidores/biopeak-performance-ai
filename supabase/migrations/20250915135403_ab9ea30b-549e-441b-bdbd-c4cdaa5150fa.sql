-- Função para calcular automaticamente o pace das atividades do HealthKit
CREATE OR REPLACE FUNCTION public.calculate_healthkit_pace()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular pace se temos distância e duração
  IF NEW.distance_meters IS NOT NULL AND NEW.distance_meters > 0 
     AND NEW.duration_seconds IS NOT NULL AND NEW.duration_seconds > 0 THEN
    NEW.pace_min_per_km := (NEW.duration_seconds / 60.0) / (NEW.distance_meters / 1000.0);
  ELSE
    NEW.pace_min_per_km := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para calcular pace automaticamente
DROP TRIGGER IF EXISTS trg_calculate_healthkit_pace ON public.healthkit_activities;
CREATE TRIGGER trg_calculate_healthkit_pace
  BEFORE INSERT OR UPDATE ON public.healthkit_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_healthkit_pace();

-- Atualizar atividades existentes do HealthKit com pace calculado
UPDATE public.healthkit_activities 
SET pace_min_per_km = CASE 
  WHEN distance_meters > 0 AND duration_seconds > 0 
  THEN (duration_seconds / 60.0) / (distance_meters / 1000.0)
  ELSE NULL 
END
WHERE pace_min_per_km IS NULL 
  AND distance_meters > 0 
  AND duration_seconds > 0;

-- Também precisa criar uma trigger para que a tabela all_activities seja atualizada quando o HealthKit for modificado
CREATE OR REPLACE FUNCTION public._ins_all_from_healthkit()
RETURNS TRIGGER AS $$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  v_minutes := CASE WHEN NEW.duration_seconds IS NOT NULL THEN NEW.duration_seconds/60.0 ELSE NULL END;
  v_pace := NEW.pace_min_per_km; -- Usa o pace já calculado
  v_activity_date := CASE WHEN NEW.start_time IS NOT NULL THEN (NEW.start_time AT TIME ZONE 'UTC')::date ELSE NEW.activity_date END;

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
    v_pace, NEW.elevation_gain_meters, NEW.elevation_loss_meters,
    'healthkit'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO UPDATE SET
    activity_type = EXCLUDED.activity_type,
    activity_date = EXCLUDED.activity_date,
    total_distance_meters = EXCLUDED.total_distance_meters,
    total_time_minutes = EXCLUDED.total_time_minutes,
    device_name = EXCLUDED.device_name,
    active_kilocalories = EXCLUDED.active_kilocalories,
    average_heart_rate = EXCLUDED.average_heart_rate,
    max_heart_rate = EXCLUDED.max_heart_rate,
    pace_min_per_km = EXCLUDED.pace_min_per_km,
    total_elevation_gain_in_meters = EXCLUDED.total_elevation_gain_in_meters,
    total_elevation_loss_in_meters = EXCLUDED.total_elevation_loss_in_meters,
    updated_at = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop e recria a trigger para all_activities
DROP TRIGGER IF EXISTS trg_ins_all_from_healthkit ON public.healthkit_activities;
CREATE TRIGGER trg_ins_all_from_healthkit
  AFTER INSERT OR UPDATE ON public.healthkit_activities
  FOR EACH ROW
  EXECUTE FUNCTION public._ins_all_from_healthkit();