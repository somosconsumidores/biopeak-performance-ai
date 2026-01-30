-- Create RPC function for aggregating activity data by category
CREATE OR REPLACE FUNCTION public.calculate_average_pace_aggregation(
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  category TEXT,
  total_distance DOUBLE PRECISION,
  total_time DOUBLE PRECISION,
  activity_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN UPPER(activity_type) IN ('RIDE','CYCLING','ROAD_BIKING','VIRTUALRIDE','MOUNTAIN_BIKING','INDOOR_CYCLING','VIRTUAL_RIDE','EBIKERIDE','VELOMOBILE') 
      THEN 'CYCLING'
      WHEN UPPER(activity_type) IN ('RUN','RUNNING','TREADMILL_RUNNING','INDOOR_CARDIO','TRAIL_RUNNING','VIRTUALRUN','TRACK_RUNNING','VIRTUAL_RUN','INDOOR_RUNNING','ULTRA_RUN','FREE_RUN') 
      THEN 'RUNNING'
      WHEN UPPER(activity_type) IN ('SWIM','LAP_SWIMMING','OPEN_WATER_SWIMMING','SWIMMING') 
      THEN 'SWIMMING'
    END as category,
    SUM(total_distance_meters)::DOUBLE PRECISION as total_distance,
    SUM(total_time_minutes)::DOUBLE PRECISION as total_time,
    COUNT(*) as activity_count
  FROM all_activities
  WHERE activity_date >= p_period_start
    AND activity_date <= p_period_end
    AND total_distance_meters > 0
    AND total_time_minutes > 0
  GROUP BY 1
  HAVING CASE 
    WHEN UPPER(activity_type) IN ('RIDE','CYCLING','ROAD_BIKING','VIRTUALRIDE','MOUNTAIN_BIKING','INDOOR_CYCLING','VIRTUAL_RIDE','EBIKERIDE','VELOMOBILE') 
    THEN 'CYCLING'
    WHEN UPPER(activity_type) IN ('RUN','RUNNING','TREADMILL_RUNNING','INDOOR_CARDIO','TRAIL_RUNNING','VIRTUALRUN','TRACK_RUNNING','VIRTUAL_RUN','INDOOR_RUNNING','ULTRA_RUN','FREE_RUN') 
    THEN 'RUNNING'
    WHEN UPPER(activity_type) IN ('SWIM','LAP_SWIMMING','OPEN_WATER_SWIMMING','SWIMMING') 
    THEN 'SWIMMING'
  END IS NOT NULL;
END;
$$;

-- Restrict access to service_role only
REVOKE ALL ON FUNCTION public.calculate_average_pace_aggregation(DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_average_pace_aggregation(DATE, DATE) TO service_role;