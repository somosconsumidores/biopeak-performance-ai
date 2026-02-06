-- Create table for pre-calculated personal records
CREATE TABLE public.my_personal_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('RUNNING', 'CYCLING', 'SWIMMING')),
  rank_position INTEGER NOT NULL CHECK (rank_position >= 1 AND rank_position <= 3),
  activity_id TEXT NOT NULL,
  activity_date DATE NOT NULL,
  best_pace_value NUMERIC NOT NULL,
  formatted_pace TEXT NOT NULL,
  activity_source TEXT NOT NULL DEFAULT 'garmin',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one record per user/category/rank
  CONSTRAINT unique_user_category_rank UNIQUE (user_id, category, rank_position)
);

-- Create indexes for performance
CREATE INDEX idx_my_personal_records_user_id ON public.my_personal_records(user_id);
CREATE INDEX idx_my_personal_records_category ON public.my_personal_records(category);
CREATE INDEX idx_my_personal_records_calculated_at ON public.my_personal_records(calculated_at);

-- Enable RLS
ALTER TABLE public.my_personal_records ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only read their own records
CREATE POLICY "Users can view their own personal records"
ON public.my_personal_records
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Only service_role can insert/update/delete (via Edge Function)
CREATE POLICY "Service role can manage all records"
ON public.my_personal_records
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Trigger to update updated_at
CREATE TRIGGER update_my_personal_records_updated_at
BEFORE UPDATE ON public.my_personal_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC Function to calculate personal records for all active subscribers
CREATE OR REPLACE FUNCTION public.calculate_personal_records_for_subscribers()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed_users INTEGER := 0;
  v_total_records INTEGER := 0;
  v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Delete existing records for active subscribers (will be recalculated)
  DELETE FROM public.my_personal_records
  WHERE user_id IN (SELECT user_id FROM mv_active_subscribers);

  -- Insert top 3 records per category for each active subscriber
  WITH categorized_activities AS (
    SELECT 
      abs.user_id,
      abs.activity_id,
      abs.activity_date,
      abs.best_1km_pace_min_km,
      aa.activity_source,
      CASE 
        WHEN UPPER(aa.activity_type) IN ('SWIM','LAP_SWIMMING','OPEN_WATER_SWIMMING','SWIMMING') 
          THEN 'SWIMMING'
        WHEN UPPER(aa.activity_type) IN ('RUN','RUNNING','TREADMILL_RUNNING','INDOOR_CARDIO',
          'TRAIL_RUNNING','VIRTUALRUN','TRACK_RUNNING','VIRTUAL_RUN','INDOOR_RUNNING','ULTRA_RUN') 
          THEN 'RUNNING'
        WHEN UPPER(aa.activity_type) IN ('RIDE','CYCLING','ROAD_BIKING','VIRTUALRIDE',
          'MOUNTAIN_BIKING','INDOOR_CYCLING','VIRTUAL_RIDE','EBIKERIDE','VELOMOBILE') 
          THEN 'CYCLING'
        ELSE NULL
      END AS category
    FROM public.activity_best_segments abs
    INNER JOIN public.all_activities aa 
      ON abs.activity_id = aa.activity_id AND abs.user_id = aa.user_id
    INNER JOIN mv_active_subscribers mas 
      ON abs.user_id = mas.user_id
    WHERE abs.best_1km_pace_min_km IS NOT NULL 
      AND abs.best_1km_pace_min_km > 0
  ),
  ranked_activities AS (
    SELECT 
      user_id,
      activity_id,
      activity_date,
      best_1km_pace_min_km,
      activity_source,
      category,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, category 
        ORDER BY best_1km_pace_min_km ASC
      ) as rank_position
    FROM categorized_activities
    WHERE category IS NOT NULL
  ),
  top3_records AS (
    SELECT 
      user_id,
      category,
      rank_position::INTEGER,
      activity_id,
      activity_date,
      best_1km_pace_min_km,
      activity_source,
      -- Format pace based on category
      CASE 
        WHEN category = 'RUNNING' THEN 
          FLOOR(best_1km_pace_min_km)::TEXT || ':' || 
          LPAD(ROUND((best_1km_pace_min_km - FLOOR(best_1km_pace_min_km)) * 60)::TEXT, 2, '0') || '/km'
        WHEN category = 'CYCLING' THEN 
          ROUND(60.0 / best_1km_pace_min_km, 1)::TEXT || ' km/h'
        WHEN category = 'SWIMMING' THEN 
          FLOOR(best_1km_pace_min_km / 10)::TEXT || ':' || 
          LPAD(ROUND(((best_1km_pace_min_km / 10) - FLOOR(best_1km_pace_min_km / 10)) * 60)::TEXT, 2, '0') || '/100m'
      END AS formatted_pace
    FROM ranked_activities
    WHERE rank_position <= 3
  )
  INSERT INTO public.my_personal_records (
    user_id,
    category,
    rank_position,
    activity_id,
    activity_date,
    best_pace_value,
    formatted_pace,
    activity_source,
    calculated_at
  )
  SELECT 
    user_id,
    category,
    rank_position,
    activity_id,
    activity_date,
    best_1km_pace_min_km,
    formatted_pace,
    activity_source,
    now()
  FROM top3_records;

  GET DIAGNOSTICS v_total_records = ROW_COUNT;
  
  SELECT COUNT(DISTINCT user_id) INTO v_processed_users
  FROM public.my_personal_records
  WHERE calculated_at >= v_start_time;

  RETURN json_build_object(
    'success', true,
    'processed_users', v_processed_users,
    'total_records', v_total_records,
    'execution_time_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER
  );
END;
$$;

-- Restrict RPC access to service_role only
REVOKE ALL ON FUNCTION public.calculate_personal_records_for_subscribers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_personal_records_for_subscribers() TO service_role;