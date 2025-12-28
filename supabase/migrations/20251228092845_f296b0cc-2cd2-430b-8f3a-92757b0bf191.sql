-- =====================================================
-- RPC: upsert_activity_chart_data
-- Replaces DELETE+INSERT with a single call and explicit timeout
-- =====================================================
CREATE OR REPLACE FUNCTION public.upsert_activity_chart_data(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text,
  p_series_data jsonb,
  p_data_points_count integer,
  p_duration_seconds double precision DEFAULT NULL,
  p_total_distance_meters double precision DEFAULT NULL,
  p_avg_speed_ms double precision DEFAULT NULL,
  p_avg_pace_min_km double precision DEFAULT NULL,
  p_avg_heart_rate double precision DEFAULT NULL,
  p_max_heart_rate double precision DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'
SET search_path = 'public'
AS $$
BEGIN
  -- Delete existing record if any
  DELETE FROM activity_chart_data
  WHERE user_id = p_user_id
    AND activity_id = p_activity_id
    AND activity_source = p_activity_source;

  -- Insert new record
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
END;
$$;

-- =====================================================
-- RPC: upsert_activity_coordinates
-- Replaces DELETE+INSERT with a single call and explicit timeout
-- =====================================================
CREATE OR REPLACE FUNCTION public.upsert_activity_coordinates(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text,
  p_coordinates jsonb,
  p_total_points integer,
  p_sampled_points integer,
  p_starting_latitude double precision DEFAULT NULL,
  p_starting_longitude double precision DEFAULT NULL,
  p_bounding_box jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'
SET search_path = 'public'
AS $$
BEGIN
  -- Delete existing record if any
  DELETE FROM activity_coordinates
  WHERE user_id = p_user_id
    AND activity_id = p_activity_id
    AND activity_source = p_activity_source;

  -- Insert new record
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
END;
$$;