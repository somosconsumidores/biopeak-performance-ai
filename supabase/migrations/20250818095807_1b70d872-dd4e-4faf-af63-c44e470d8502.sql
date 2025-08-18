-- Create or replace RPC to reprocess Garmin userMetrics into garmin_vo2max
CREATE OR REPLACE FUNCTION public.reprocess_all_user_metrics_vo2max()
RETURNS TABLE(processed_logs integer, inserted_rows integer, updated_rows integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed int := 0;
  v_inserted int := 0;
  v_updated int := 0;
BEGIN
  -- Only admins can execute
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Insufficient privileges' USING ERRCODE = '42501';
  END IF;

  -- Collect candidate VO2 rows from webhook logs
  CREATE TEMP TABLE tmp_vo2 (
    garmin_user_id text NOT NULL,
    calendar_date date NOT NULL,
    vo2_max_running numeric,
    vo2_max_cycling numeric
  ) ON COMMIT DROP;

  INSERT INTO tmp_vo2 (garmin_user_id, calendar_date, vo2_max_running, vo2_max_cycling)
  SELECT
    COALESCE(l.garmin_user_id, (m->>'userId'))::text AS garmin_user_id,
    (m->>'calendarDate')::date AS calendar_date,
    -- Prefer explicit running metric, else fallback to generic variants
    COALESCE(
      NULLIF(m->>'vo2MaxRunning','')::numeric,
      NULLIF(m->>'vo2MaxGeneric','')::numeric,
      NULLIF(m->>'genericVo2','')::numeric,
      NULLIF(m->>'genericVo2Max','')::numeric,
      NULLIF(m->>'vo2Max','')::numeric
    ) AS vo2_max_running,
    NULLIF(m->>'vo2MaxCycling','')::numeric AS vo2_max_cycling
  FROM garmin_webhook_logs l
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(l.payload->'userMetrics', '[]'::jsonb)) AS m
  WHERE l.webhook_type = 'userMetrics';

  GET DIAGNOSTICS v_processed = ROW_COUNT;

  WITH aggregated AS (
    SELECT garmin_user_id, calendar_date,
           avg(vo2_max_running) AS vo2_max_running,
           avg(vo2_max_cycling) AS vo2_max_cycling
    FROM tmp_vo2
    WHERE garmin_user_id IS NOT NULL AND calendar_date IS NOT NULL
    GROUP BY 1,2
  ), upserted AS (
    INSERT INTO garmin_vo2max (garmin_user_id, calendar_date, vo2_max_running, vo2_max_cycling)
    SELECT garmin_user_id, calendar_date, vo2_max_running, vo2_max_cycling
    FROM aggregated
    ON CONFLICT (garmin_user_id, calendar_date)
    DO UPDATE SET
      vo2_max_running = COALESCE(EXCLUDED.vo2_max_running, garmin_vo2max.vo2_max_running),
      vo2_max_cycling = COALESCE(EXCLUDED.vo2_max_cycling, garmin_vo2max.vo2_max_cycling)
    RETURNING (xmax = 0) AS inserted
  )
  SELECT 
    COALESCE(SUM(CASE WHEN inserted THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN NOT inserted THEN 1 ELSE 0 END),0)
  INTO v_inserted, v_updated
  FROM upserted;

  RETURN QUERY SELECT COALESCE(v_processed,0), COALESCE(v_inserted,0), COALESCE(v_updated,0);
END;
$$;

-- Grant execution to authenticated users; function itself checks admin role
GRANT EXECUTE ON FUNCTION public.reprocess_all_user_metrics_vo2max() TO authenticated;