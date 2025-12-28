-- RPC para upsert de activity_chart_data com timeout estendido (60s)
CREATE OR REPLACE FUNCTION public.upsert_activity_chart_data(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text,
  p_series_data jsonb,
  p_data_points_count int,
  p_duration_seconds int,
  p_total_distance_meters numeric,
  p_avg_speed_ms numeric,
  p_avg_pace_min_km numeric,
  p_avg_heart_rate int,
  p_max_heart_rate int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Estende timeout para 60 segundos para operações pesadas
  PERFORM set_config('statement_timeout', '60000', true);
  
  -- Delete existing entries
  DELETE FROM activity_chart_data 
  WHERE user_id = p_user_id 
    AND activity_source = p_activity_source 
    AND activity_id = p_activity_id;
    
  -- Insert new data
  INSERT INTO activity_chart_data (
    user_id,
    activity_id,
    activity_source,
    series_data,
    data_points_count,
    duration_seconds,
    total_distance_meters,
    avg_speed_ms,
    avg_pace_min_km,
    avg_heart_rate,
    max_heart_rate,
    processed_at
  ) VALUES (
    p_user_id,
    p_activity_id,
    p_activity_source,
    p_series_data,
    p_data_points_count,
    p_duration_seconds,
    p_total_distance_meters,
    p_avg_speed_ms,
    p_avg_pace_min_km,
    p_avg_heart_rate,
    p_max_heart_rate,
    now()
  );
  
  RETURN jsonb_build_object('success', true, 'rows_inserted', 1);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- RPC para upsert de activity_coordinates com timeout estendido (60s)
CREATE OR REPLACE FUNCTION public.upsert_activity_coordinates(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text,
  p_coordinates jsonb,
  p_total_points int,
  p_sampled_points int,
  p_starting_latitude numeric,
  p_starting_longitude numeric,
  p_bounding_box jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Estende timeout para 60 segundos para operações pesadas
  PERFORM set_config('statement_timeout', '60000', true);
  
  -- Delete existing entries
  DELETE FROM activity_coordinates 
  WHERE user_id = p_user_id 
    AND activity_source = p_activity_source 
    AND activity_id = p_activity_id;
    
  -- Insert new data
  INSERT INTO activity_coordinates (
    user_id,
    activity_id,
    activity_source,
    coordinates,
    total_points,
    sampled_points,
    starting_latitude,
    starting_longitude,
    bounding_box
  ) VALUES (
    p_user_id,
    p_activity_id,
    p_activity_source,
    p_coordinates,
    p_total_points,
    p_sampled_points,
    p_starting_latitude,
    p_starting_longitude,
    p_bounding_box
  );
  
  RETURN jsonb_build_object('success', true, 'rows_inserted', 1);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.upsert_activity_chart_data FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_activity_chart_data TO service_role;

REVOKE ALL ON FUNCTION public.upsert_activity_coordinates FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_activity_coordinates TO service_role;