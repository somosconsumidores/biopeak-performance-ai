
-- Fix ambiguous column reference by explicitly selecting from all_activities
CREATE OR REPLACE FUNCTION populate_deduplicada_subscribers_full()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  TRUNCATE public.all_activities_deduplicada_subscribers;
  
  INSERT INTO public.all_activities_deduplicada_subscribers
    (id, user_id, activity_id, activity_type, activity_date,
     total_distance_meters, total_time_minutes, device_name,
     active_kilocalories, average_heart_rate, max_heart_rate,
     pace_min_per_km, total_elevation_gain_in_meters,
     total_elevation_loss_in_meters, activity_source,
     created_at, updated_at, detected_workout_type)
  SELECT aa.id, aa.user_id, aa.activity_id, aa.activity_type, aa.activity_date,
         aa.total_distance_meters, aa.total_time_minutes, aa.device_name,
         aa.active_kilocalories, aa.average_heart_rate, aa.max_heart_rate,
         aa.pace_min_per_km, aa.total_elevation_gain_in_meters,
         aa.total_elevation_loss_in_meters, aa.activity_source,
         aa.created_at, aa.updated_at, aa.detected_workout_type
  FROM public.all_activities aa
  JOIN public.subscribers s ON aa.user_id = s.user_id AND s.subscribed = true
  WHERE ROW_NUMBER() OVER (
    PARTITION BY aa.user_id, aa.activity_date, 
                 ROUND(COALESCE(aa.total_time_minutes, 0))
    ORDER BY 
      CASE aa.activity_source
        WHEN 'garmin' THEN 1
        WHEN 'polar' THEN 2
        WHEN 'healthkit' THEN 3
        WHEN 'strava' THEN 4
        ELSE 5
      END,
      aa.created_at ASC
  ) = 1;
END;
$$;

-- Fix incremental too
CREATE OR REPLACE FUNCTION populate_deduplicada_subscribers_incremental()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  affected_rows integer;
BEGIN
  DELETE FROM public.all_activities_deduplicada_subscribers d
  WHERE d.user_id IN (
    SELECT DISTINCT aa.user_id 
    FROM public.all_activities aa
    WHERE aa.created_at >= NOW() - INTERVAL '2 days'
  )
  AND d.activity_date >= (CURRENT_DATE - INTERVAL '2 days');

  INSERT INTO public.all_activities_deduplicada_subscribers
    (id, user_id, activity_id, activity_type, activity_date,
     total_distance_meters, total_time_minutes, device_name,
     active_kilocalories, average_heart_rate, max_heart_rate,
     pace_min_per_km, total_elevation_gain_in_meters,
     total_elevation_loss_in_meters, activity_source,
     created_at, updated_at, detected_workout_type)
  SELECT sub.id, sub.user_id, sub.activity_id, sub.activity_type, sub.activity_date,
         sub.total_distance_meters, sub.total_time_minutes, sub.device_name,
         sub.active_kilocalories, sub.average_heart_rate, sub.max_heart_rate,
         sub.pace_min_per_km, sub.total_elevation_gain_in_meters,
         sub.total_elevation_loss_in_meters, sub.activity_source,
         sub.created_at, sub.updated_at, sub.detected_workout_type
  FROM (
    SELECT aa.id, aa.user_id, aa.activity_id, aa.activity_type, aa.activity_date,
           aa.total_distance_meters, aa.total_time_minutes, aa.device_name,
           aa.active_kilocalories, aa.average_heart_rate, aa.max_heart_rate,
           aa.pace_min_per_km, aa.total_elevation_gain_in_meters,
           aa.total_elevation_loss_in_meters, aa.activity_source,
           aa.created_at, aa.updated_at, aa.detected_workout_type,
           ROW_NUMBER() OVER (
             PARTITION BY aa.user_id, aa.activity_date, 
                          ROUND(COALESCE(aa.total_time_minutes, 0))
             ORDER BY 
               CASE aa.activity_source
                 WHEN 'garmin' THEN 1
                 WHEN 'polar' THEN 2
                 WHEN 'healthkit' THEN 3
                 WHEN 'strava' THEN 4
                 ELSE 5
               END,
               aa.created_at ASC
           ) as rn
    FROM public.all_activities aa
    JOIN public.subscribers s ON aa.user_id = s.user_id AND s.subscribed = true
    WHERE aa.user_id IN (
      SELECT DISTINCT a2.user_id 
      FROM public.all_activities a2
      WHERE a2.created_at >= NOW() - INTERVAL '2 days'
    )
    AND aa.activity_date >= (CURRENT_DATE - INTERVAL '2 days')
  ) sub
  WHERE sub.rn = 1
  ON CONFLICT (id) DO UPDATE SET
    activity_type = EXCLUDED.activity_type,
    total_distance_meters = EXCLUDED.total_distance_meters,
    total_time_minutes = EXCLUDED.total_time_minutes,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

-- Re-apply permissions
REVOKE ALL ON FUNCTION populate_deduplicada_subscribers_full() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION populate_deduplicada_subscribers_full() TO service_role;

REVOKE ALL ON FUNCTION populate_deduplicada_subscribers_incremental() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION populate_deduplicada_subscribers_incremental() TO service_role;
