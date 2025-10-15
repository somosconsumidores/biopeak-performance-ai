-- Create enhanced weekly summary function with comprehensive metrics
CREATE OR REPLACE FUNCTION public.weekly_summary_stats_v2(
  start_date date,
  end_date date,
  previous_start_date date,
  previous_end_date date
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  total_km numeric,
  activities_count bigint,
  active_days bigint,
  calories numeric,
  total_hours numeric,
  avg_pace_min_km numeric,
  avg_heart_rate numeric,
  max_heart_rate_week integer,
  total_elevation_gain numeric,
  longest_distance_km numeric,
  longest_duration_hours numeric,
  best_pace_min_km numeric,
  prev_total_km numeric,
  prev_activities_count bigint,
  distance_change_percent numeric,
  activities_change integer,
  activity_types jsonb,
  consistency_score numeric,
  avg_km_per_activity numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  WITH current_week AS (
    SELECT 
      aa.user_id,
      COUNT(*)::bigint as activities_count,
      COUNT(DISTINCT aa.activity_date)::bigint as active_days,
      ROUND(SUM(aa.total_distance_meters) / 1000.0, 2) as total_km,
      ROUND(SUM(aa.total_time_minutes) / 60.0, 2) as total_hours,
      ROUND(SUM(aa.active_kilocalories), 0) as calories,
      ROUND(AVG(NULLIF(aa.pace_min_per_km, 0)) FILTER (WHERE aa.pace_min_per_km > 0 AND aa.pace_min_per_km < 15), 2) as avg_pace,
      ROUND(AVG(NULLIF(aa.average_heart_rate, 0)) FILTER (WHERE aa.average_heart_rate BETWEEN 30 AND 220)::numeric, 0) as avg_hr,
      MAX(aa.max_heart_rate) as max_hr,
      ROUND(SUM(COALESCE(aa.total_elevation_gain_in_meters, 0)), 0) as elevation,
      ROUND(MAX(aa.total_distance_meters) / 1000.0, 2) as longest_dist,
      ROUND(MAX(aa.total_time_minutes) / 60.0, 2) as longest_dur,
      ROUND(MIN(NULLIF(aa.pace_min_per_km, 0)) FILTER (WHERE aa.pace_min_per_km > 0 AND aa.pace_min_per_km < 15), 2) as best_pace
    FROM public.all_activities aa
    WHERE aa.activity_date BETWEEN start_date AND end_date
      AND aa.total_distance_meters > 100
    GROUP BY aa.user_id
  ),
  previous_week AS (
    SELECT 
      aa.user_id,
      COUNT(*)::bigint as prev_activities_count,
      ROUND(SUM(aa.total_distance_meters) / 1000.0, 2) as prev_total_km
    FROM public.all_activities aa
    WHERE aa.activity_date BETWEEN previous_start_date AND previous_end_date
      AND aa.total_distance_meters > 100
    GROUP BY aa.user_id
  ),
  activity_breakdown AS (
    SELECT 
      sub.user_id,
      jsonb_object_agg(
        COALESCE(sub.activity_type, 'Unknown'), 
        sub.activity_count
      ) as activity_types
    FROM (
      SELECT 
        aa.user_id,
        aa.activity_type,
        COUNT(*)::integer as activity_count
      FROM public.all_activities aa
      WHERE aa.activity_date BETWEEN start_date AND end_date
      GROUP BY aa.user_id, aa.activity_type
    ) sub
    GROUP BY sub.user_id
  )
  SELECT 
    cw.user_id,
    p.email,
    COALESCE(p.display_name, p.email) as display_name,
    cw.total_km,
    cw.activities_count,
    cw.active_days,
    cw.calories,
    cw.total_hours,
    cw.avg_pace as avg_pace_min_km,
    cw.avg_hr as avg_heart_rate,
    cw.max_hr as max_heart_rate_week,
    cw.elevation as total_elevation_gain,
    cw.longest_dist as longest_distance_km,
    cw.longest_dur as longest_duration_hours,
    cw.best_pace as best_pace_min_km,
    COALESCE(pw.prev_total_km, 0) as prev_total_km,
    COALESCE(pw.prev_activities_count, 0) as prev_activities_count,
    CASE 
      WHEN pw.prev_total_km > 0 THEN 
        ROUND(((cw.total_km - pw.prev_total_km) / pw.prev_total_km) * 100, 1)
      ELSE NULL
    END as distance_change_percent,
    CASE 
      WHEN pw.prev_activities_count > 0 THEN 
        (cw.activities_count - pw.prev_activities_count)::integer
      ELSE NULL
    END as activities_change,
    ab.activity_types,
    ROUND((cw.active_days::numeric / 7.0) * 100, 0) as consistency_score,
    ROUND(cw.total_km / cw.activities_count, 1) as avg_km_per_activity
  FROM current_week cw
  LEFT JOIN public.profiles p ON p.user_id = cw.user_id
  LEFT JOIN previous_week pw ON pw.user_id = cw.user_id
  LEFT JOIN activity_breakdown ab ON ab.user_id = cw.user_id
  ORDER BY cw.total_km DESC;
END;
$$;

-- Create performance indexes for weekly summary queries
CREATE INDEX IF NOT EXISTS idx_all_activities_user_date 
ON public.all_activities(user_id, activity_date)
WHERE activity_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_all_activities_date_range 
ON public.all_activities(activity_date)
WHERE activity_date IS NOT NULL AND total_distance_meters > 100;