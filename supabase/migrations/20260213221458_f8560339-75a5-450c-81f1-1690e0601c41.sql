
-- 1. Tabela deduplicada
CREATE TABLE IF NOT EXISTS public.all_activities_deduplicada_subscribers (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_id text,
  activity_type text,
  activity_date date,
  total_distance_meters double precision,
  total_time_minutes double precision,
  device_name text,
  active_kilocalories integer,
  average_heart_rate integer,
  max_heart_rate integer,
  pace_min_per_km double precision,
  total_elevation_gain_in_meters double precision,
  total_elevation_loss_in_meters double precision,
  activity_source text,
  created_at timestamptz,
  updated_at timestamptz,
  detected_workout_type text
);

CREATE INDEX idx_dedup_sub_user_date 
  ON all_activities_deduplicada_subscribers(user_id, activity_date);
CREATE INDEX idx_dedup_sub_source 
  ON all_activities_deduplicada_subscribers(activity_source);
CREATE INDEX idx_dedup_sub_created 
  ON all_activities_deduplicada_subscribers(created_at);

-- 2. RPC full rebuild
CREATE OR REPLACE FUNCTION populate_deduplicada_subscribers_full()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  TRUNCATE public.all_activities_deduplicada_subscribers;
  
  INSERT INTO public.all_activities_deduplicada_subscribers
  SELECT a.id, a.user_id, a.activity_id, a.activity_type, a.activity_date,
         a.total_distance_meters, a.total_time_minutes, a.device_name,
         a.active_kilocalories, a.average_heart_rate, a.max_heart_rate,
         a.pace_min_per_km, a.total_elevation_gain_in_meters,
         a.total_elevation_loss_in_meters, a.activity_source,
         a.created_at, a.updated_at, a.detected_workout_type
  FROM (
    SELECT *, ROW_NUMBER() OVER (
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
  ) a
  WHERE a.rn = 1;
END;
$$;

-- 3. RPC incremental (ultimos 2 dias)
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
  SELECT a.id, a.user_id, a.activity_id, a.activity_type, a.activity_date,
         a.total_distance_meters, a.total_time_minutes, a.device_name,
         a.active_kilocalories, a.average_heart_rate, a.max_heart_rate,
         a.pace_min_per_km, a.total_elevation_gain_in_meters,
         a.total_elevation_loss_in_meters, a.activity_source,
         a.created_at, a.updated_at, a.detected_workout_type
  FROM (
    SELECT *, ROW_NUMBER() OVER (
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
  ) a
  WHERE a.rn = 1
  ON CONFLICT (id) DO UPDATE SET
    activity_type = EXCLUDED.activity_type,
    total_distance_meters = EXCLUDED.total_distance_meters,
    total_time_minutes = EXCLUDED.total_time_minutes,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

-- 4. Permissoes
REVOKE ALL ON FUNCTION populate_deduplicada_subscribers_full() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION populate_deduplicada_subscribers_full() TO service_role;

REVOKE ALL ON FUNCTION populate_deduplicada_subscribers_incremental() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION populate_deduplicada_subscribers_incremental() TO service_role;

-- 5. RLS
ALTER TABLE all_activities_deduplicada_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dedup activities"
  ON all_activities_deduplicada_subscribers FOR SELECT
  USING (auth.uid() = user_id);
