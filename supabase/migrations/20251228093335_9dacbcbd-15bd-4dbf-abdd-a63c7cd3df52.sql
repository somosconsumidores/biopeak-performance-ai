-- =============================================
-- FIX: Remove duplicate function overloads
-- Drop all existing overloads and create single canonical versions
-- =============================================

-- Drop ALL existing overloads of upsert_activity_chart_data
DROP FUNCTION IF EXISTS public.upsert_activity_chart_data(uuid, text, text, jsonb, integer, integer, numeric, numeric, numeric, integer, integer);
DROP FUNCTION IF EXISTS public.upsert_activity_chart_data(uuid, text, text, jsonb, integer, double precision, double precision, double precision, double precision, double precision, double precision);

-- Drop ALL existing overloads of upsert_activity_coordinates  
DROP FUNCTION IF EXISTS public.upsert_activity_coordinates(uuid, text, text, jsonb, integer, integer, jsonb, double precision, double precision);
DROP FUNCTION IF EXISTS public.upsert_activity_coordinates(uuid, text, text, jsonb, integer, integer, jsonb, numeric, numeric);

-- =============================================
-- CREATE CANONICAL upsert_activity_chart_data
-- =============================================
CREATE OR REPLACE FUNCTION public.upsert_activity_chart_data(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text,
  p_series_data jsonb,
  p_data_points_count integer,
  p_duration_seconds double precision,
  p_total_distance_meters double precision,
  p_avg_speed_ms double precision,
  p_avg_pace_min_km double precision,
  p_avg_heart_rate integer,
  p_max_heart_rate integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
BEGIN
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
    processed_at,
    created_at,
    updated_at
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
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, activity_id, activity_source)
  DO UPDATE SET
    series_data = EXCLUDED.series_data,
    data_points_count = EXCLUDED.data_points_count,
    duration_seconds = EXCLUDED.duration_seconds,
    total_distance_meters = EXCLUDED.total_distance_meters,
    avg_speed_ms = EXCLUDED.avg_speed_ms,
    avg_pace_min_km = EXCLUDED.avg_pace_min_km,
    avg_heart_rate = EXCLUDED.avg_heart_rate,
    max_heart_rate = EXCLUDED.max_heart_rate,
    processed_at = now(),
    updated_at = now();
END;
$$;

-- =============================================
-- CREATE CANONICAL upsert_activity_coordinates
-- =============================================
CREATE OR REPLACE FUNCTION public.upsert_activity_coordinates(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text,
  p_coordinates jsonb,
  p_total_points integer,
  p_sampled_points integer,
  p_bounding_box jsonb,
  p_starting_latitude double precision,
  p_starting_longitude double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
BEGIN
  INSERT INTO activity_coordinates (
    user_id,
    activity_id,
    activity_source,
    coordinates,
    total_points,
    sampled_points,
    bounding_box,
    starting_latitude,
    starting_longitude,
    created_at
  ) VALUES (
    p_user_id,
    p_activity_id,
    p_activity_source,
    p_coordinates,
    p_total_points,
    p_sampled_points,
    p_bounding_box,
    p_starting_latitude,
    p_starting_longitude,
    now()
  )
  ON CONFLICT (user_id, activity_id, activity_source)
  DO UPDATE SET
    coordinates = EXCLUDED.coordinates,
    total_points = EXCLUDED.total_points,
    sampled_points = EXCLUDED.sampled_points,
    bounding_box = EXCLUDED.bounding_box,
    starting_latitude = EXCLUDED.starting_latitude,
    starting_longitude = EXCLUDED.starting_longitude;
END;
$$;