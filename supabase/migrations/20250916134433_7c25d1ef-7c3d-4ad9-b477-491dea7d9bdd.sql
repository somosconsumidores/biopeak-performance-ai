-- Função trigger para calcular automaticamente o melhor segmento de 1km
CREATE OR REPLACE FUNCTION public.auto_calculate_best_1km_segment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  segment_result jsonb;
  activity_date_val date;
BEGIN
  -- Chama a função para encontrar o melhor segmento de 1km
  segment_result := public.find_fastest_1km_segment(
    NEW.user_id, 
    NEW.activity_id, 
    NEW.activity_source
  );
  
  -- Se encontrou um segmento válido, insere/atualiza na tabela de melhores segmentos
  IF segment_result IS NOT NULL THEN
    -- Tenta derivar a data da atividade das tabelas de atividades
    CASE LOWER(NEW.activity_source)
      WHEN 'garmin' THEN
        SELECT activity_date INTO activity_date_val
        FROM public.garmin_activities 
        WHERE user_id = NEW.user_id AND activity_id = NEW.activity_id
        LIMIT 1;
      WHEN 'strava' THEN
        SELECT (start_date AT TIME ZONE 'UTC')::date INTO activity_date_val
        FROM public.strava_activities 
        WHERE user_id = NEW.user_id AND strava_activity_id::text = NEW.activity_id
        LIMIT 1;
      WHEN 'strava_gpx' THEN
        SELECT (start_time AT TIME ZONE 'UTC')::date INTO activity_date_val
        FROM public.strava_gpx_activities 
        WHERE user_id = NEW.user_id AND activity_id = NEW.activity_id
        LIMIT 1;
      WHEN 'polar' THEN
        SELECT (start_time AT TIME ZONE 'UTC')::date INTO activity_date_val
        FROM public.polar_activities 
        WHERE user_id = NEW.user_id AND activity_id = NEW.activity_id
        LIMIT 1;
      ELSE
        activity_date_val := CURRENT_DATE;
    END CASE;
    
    -- Se não conseguiu encontrar a data, usa data atual
    IF activity_date_val IS NULL THEN
      activity_date_val := CURRENT_DATE;
    END IF;
    
    -- Insere ou atualiza o melhor segmento
    INSERT INTO public.activity_best_segments (
      user_id,
      activity_id,
      activity_date,
      best_1km_pace_min_km,
      segment_start_distance_meters,
      segment_end_distance_meters,
      segment_duration_seconds
    ) VALUES (
      NEW.user_id,
      NEW.activity_id,
      activity_date_val,
      (segment_result->>'avg_pace_min_km')::numeric,
      (segment_result->>'start_distance_m')::numeric,
      (segment_result->>'end_distance_m')::numeric,
      (segment_result->>'duration_seconds')::numeric
    )
    ON CONFLICT (user_id, activity_id) 
    DO UPDATE SET
      activity_date = EXCLUDED.activity_date,
      best_1km_pace_min_km = EXCLUDED.best_1km_pace_min_km,
      segment_start_distance_meters = EXCLUDED.segment_start_distance_meters,
      segment_end_distance_meters = EXCLUDED.segment_end_distance_meters,
      segment_duration_seconds = EXCLUDED.segment_duration_seconds,
      updated_at = NOW();
      
    RAISE NOTICE 'Melhor segmento de 1km calculado automaticamente para atividade % do usuário %', NEW.activity_id, NEW.user_id;
  ELSE
    RAISE NOTICE 'Nenhum segmento válido de 1km encontrado para atividade % do usuário %', NEW.activity_id, NEW.user_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro mas não bloqueia a inserção dos dados de chart
    RAISE WARNING 'Erro ao calcular melhor segmento de 1km para atividade % do usuário %: %', NEW.activity_id, NEW.user_id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- Cria a trigger para executar após inserção na tabela activity_chart_data
CREATE TRIGGER trg_auto_calculate_best_1km_segment
  AFTER INSERT ON public.activity_chart_data
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_best_1km_segment();