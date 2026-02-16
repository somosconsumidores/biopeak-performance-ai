
-- ============================================================
-- 1. Function: Replicate HealthKit sleep to garmin_sleep_summaries
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_replicate_healthkit_to_garmin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary_id TEXT;
  v_has_real_garmin BOOLEAN;
  v_start_epoch BIGINT;
  v_end_epoch BIGINT;
BEGIN
  v_summary_id := 'healthkit_' || NEW.calendar_date::TEXT;

  -- Check if a real Garmin record exists for this user+date
  SELECT EXISTS(
    SELECT 1 FROM garmin_sleep_summaries
    WHERE user_id = NEW.user_id
      AND calendar_date = NEW.calendar_date
      AND summary_id NOT LIKE 'healthkit_%'
      AND summary_id NOT LIKE 'polar_%'
  ) INTO v_has_real_garmin;

  -- If real Garmin data exists, do nothing
  IF v_has_real_garmin THEN
    RETURN NEW;
  END IF;

  -- Convert timestamps to epoch seconds (seconds since midnight GMT)
  v_start_epoch := CASE WHEN NEW.start_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM NEW.start_time)::BIGINT
    ELSE NULL END;
  v_end_epoch := CASE WHEN NEW.end_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM NEW.end_time)::BIGINT
    ELSE NULL END;

  -- Upsert into garmin_sleep_summaries
  INSERT INTO garmin_sleep_summaries (
    user_id, summary_id, calendar_date,
    sleep_time_in_seconds, deep_sleep_duration_in_seconds,
    light_sleep_duration_in_seconds, rem_sleep_duration_in_seconds,
    awake_duration_in_seconds, sleep_score, sleep_score_feedback,
    sleep_start_time_in_seconds, sleep_end_time_in_seconds,
    synced_at, created_at, updated_at
  ) VALUES (
    NEW.user_id, v_summary_id, NEW.calendar_date,
    NEW.total_sleep_seconds, NEW.deep_sleep_seconds,
    NEW.light_sleep_seconds, NEW.rem_sleep_seconds,
    NEW.awake_seconds, NEW.sleep_score,
    COALESCE(NEW.source_name, 'HealthKit'),
    v_start_epoch, v_end_epoch,
    COALESCE(NEW.synced_at, now()), now(), now()
  )
  ON CONFLICT (user_id, summary_id) DO UPDATE SET
    sleep_time_in_seconds = EXCLUDED.sleep_time_in_seconds,
    deep_sleep_duration_in_seconds = EXCLUDED.deep_sleep_duration_in_seconds,
    light_sleep_duration_in_seconds = EXCLUDED.light_sleep_duration_in_seconds,
    rem_sleep_duration_in_seconds = EXCLUDED.rem_sleep_duration_in_seconds,
    awake_duration_in_seconds = EXCLUDED.awake_duration_in_seconds,
    sleep_score = EXCLUDED.sleep_score,
    sleep_score_feedback = EXCLUDED.sleep_score_feedback,
    sleep_start_time_in_seconds = EXCLUDED.sleep_start_time_in_seconds,
    sleep_end_time_in_seconds = EXCLUDED.sleep_end_time_in_seconds,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Trigger on healthkit_sleep_summaries
-- ============================================================
DROP TRIGGER IF EXISTS trg_replicate_healthkit_to_garmin ON healthkit_sleep_summaries;
CREATE TRIGGER trg_replicate_healthkit_to_garmin
  AFTER INSERT OR UPDATE ON healthkit_sleep_summaries
  FOR EACH ROW
  EXECUTE FUNCTION fn_replicate_healthkit_to_garmin();

-- ============================================================
-- 3. Function: Replicate Polar sleep to garmin_sleep_summaries
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_replicate_polar_to_garmin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary_id TEXT;
  v_has_real_garmin BOOLEAN;
  v_start_epoch BIGINT;
  v_end_epoch BIGINT;
BEGIN
  v_summary_id := 'polar_' || NEW.date::TEXT;

  -- Check if a real Garmin record exists for this user+date
  SELECT EXISTS(
    SELECT 1 FROM garmin_sleep_summaries
    WHERE user_id = NEW.user_id
      AND calendar_date = NEW.date
      AND summary_id NOT LIKE 'healthkit_%'
      AND summary_id NOT LIKE 'polar_%'
  ) INTO v_has_real_garmin;

  IF v_has_real_garmin THEN
    RETURN NEW;
  END IF;

  v_start_epoch := CASE WHEN NEW.sleep_start_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM NEW.sleep_start_time)::BIGINT
    ELSE NULL END;
  v_end_epoch := CASE WHEN NEW.sleep_end_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM NEW.sleep_end_time)::BIGINT
    ELSE NULL END;

  INSERT INTO garmin_sleep_summaries (
    user_id, summary_id, calendar_date,
    sleep_time_in_seconds, deep_sleep_duration_in_seconds,
    light_sleep_duration_in_seconds, rem_sleep_duration_in_seconds,
    awake_duration_in_seconds, sleep_score, sleep_score_feedback,
    sleep_start_time_in_seconds, sleep_end_time_in_seconds,
    synced_at, created_at, updated_at
  ) VALUES (
    NEW.user_id, v_summary_id, NEW.date,
    NEW.total_sleep, NEW.deep_sleep,
    NEW.light_sleep, NEW.rem_sleep,
    NEW.total_interruption_duration, NEW.sleep_score,
    'Polar',
    v_start_epoch, v_end_epoch,
    COALESCE(NEW.synced_at, now()), now(), now()
  )
  ON CONFLICT (user_id, summary_id) DO UPDATE SET
    sleep_time_in_seconds = EXCLUDED.sleep_time_in_seconds,
    deep_sleep_duration_in_seconds = EXCLUDED.deep_sleep_duration_in_seconds,
    light_sleep_duration_in_seconds = EXCLUDED.light_sleep_duration_in_seconds,
    rem_sleep_duration_in_seconds = EXCLUDED.rem_sleep_duration_in_seconds,
    awake_duration_in_seconds = EXCLUDED.awake_duration_in_seconds,
    sleep_score = EXCLUDED.sleep_score,
    sleep_score_feedback = EXCLUDED.sleep_score_feedback,
    sleep_start_time_in_seconds = EXCLUDED.sleep_start_time_in_seconds,
    sleep_end_time_in_seconds = EXCLUDED.sleep_end_time_in_seconds,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Trigger on polar_sleep
-- ============================================================
DROP TRIGGER IF EXISTS trg_replicate_polar_to_garmin ON polar_sleep;
CREATE TRIGGER trg_replicate_polar_to_garmin
  AFTER INSERT OR UPDATE ON polar_sleep
  FOR EACH ROW
  EXECUTE FUNCTION fn_replicate_polar_to_garmin();

-- ============================================================
-- 5. Backfill: Replicate existing HealthKit data
-- ============================================================
INSERT INTO garmin_sleep_summaries (
  user_id, summary_id, calendar_date,
  sleep_time_in_seconds, deep_sleep_duration_in_seconds,
  light_sleep_duration_in_seconds, rem_sleep_duration_in_seconds,
  awake_duration_in_seconds, sleep_score, sleep_score_feedback,
  sleep_start_time_in_seconds, sleep_end_time_in_seconds,
  synced_at, created_at, updated_at
)
SELECT
  h.user_id,
  'healthkit_' || h.calendar_date::TEXT,
  h.calendar_date,
  h.total_sleep_seconds,
  h.deep_sleep_seconds,
  h.light_sleep_seconds,
  h.rem_sleep_seconds,
  h.awake_seconds,
  h.sleep_score,
  COALESCE(h.source_name, 'HealthKit'),
  CASE WHEN h.start_time IS NOT NULL THEN EXTRACT(EPOCH FROM h.start_time)::BIGINT ELSE NULL END,
  CASE WHEN h.end_time IS NOT NULL THEN EXTRACT(EPOCH FROM h.end_time)::BIGINT ELSE NULL END,
  COALESCE(h.synced_at, now()),
  now(),
  now()
FROM healthkit_sleep_summaries h
WHERE NOT EXISTS (
  SELECT 1 FROM garmin_sleep_summaries g
  WHERE g.user_id = h.user_id
    AND g.calendar_date = h.calendar_date
    AND g.summary_id NOT LIKE 'healthkit_%'
    AND g.summary_id NOT LIKE 'polar_%'
)
ON CONFLICT (user_id, summary_id) DO UPDATE SET
  sleep_time_in_seconds = EXCLUDED.sleep_time_in_seconds,
  deep_sleep_duration_in_seconds = EXCLUDED.deep_sleep_duration_in_seconds,
  light_sleep_duration_in_seconds = EXCLUDED.light_sleep_duration_in_seconds,
  rem_sleep_duration_in_seconds = EXCLUDED.rem_sleep_duration_in_seconds,
  awake_duration_in_seconds = EXCLUDED.awake_duration_in_seconds,
  sleep_score = EXCLUDED.sleep_score,
  sleep_score_feedback = EXCLUDED.sleep_score_feedback,
  sleep_start_time_in_seconds = EXCLUDED.sleep_start_time_in_seconds,
  sleep_end_time_in_seconds = EXCLUDED.sleep_end_time_in_seconds,
  updated_at = now();

-- ============================================================
-- 6. Backfill: Replicate existing Polar data
-- ============================================================
INSERT INTO garmin_sleep_summaries (
  user_id, summary_id, calendar_date,
  sleep_time_in_seconds, deep_sleep_duration_in_seconds,
  light_sleep_duration_in_seconds, rem_sleep_duration_in_seconds,
  awake_duration_in_seconds, sleep_score, sleep_score_feedback,
  sleep_start_time_in_seconds, sleep_end_time_in_seconds,
  synced_at, created_at, updated_at
)
SELECT
  p.user_id,
  'polar_' || p.date::TEXT,
  p.date,
  p.total_sleep,
  p.deep_sleep,
  p.light_sleep,
  p.rem_sleep,
  p.total_interruption_duration,
  p.sleep_score,
  'Polar',
  CASE WHEN p.sleep_start_time IS NOT NULL THEN EXTRACT(EPOCH FROM p.sleep_start_time)::BIGINT ELSE NULL END,
  CASE WHEN p.sleep_end_time IS NOT NULL THEN EXTRACT(EPOCH FROM p.sleep_end_time)::BIGINT ELSE NULL END,
  COALESCE(p.synced_at, now()),
  now(),
  now()
FROM polar_sleep p
WHERE NOT EXISTS (
  SELECT 1 FROM garmin_sleep_summaries g
  WHERE g.user_id = p.user_id
    AND g.calendar_date = p.date
    AND g.summary_id NOT LIKE 'healthkit_%'
    AND g.summary_id NOT LIKE 'polar_%'
)
ON CONFLICT (user_id, summary_id) DO UPDATE SET
  sleep_time_in_seconds = EXCLUDED.sleep_time_in_seconds,
  deep_sleep_duration_in_seconds = EXCLUDED.deep_sleep_duration_in_seconds,
  light_sleep_duration_in_seconds = EXCLUDED.light_sleep_duration_in_seconds,
  rem_sleep_duration_in_seconds = EXCLUDED.rem_sleep_duration_in_seconds,
  awake_duration_in_seconds = EXCLUDED.awake_duration_in_seconds,
  sleep_score = EXCLUDED.sleep_score,
  sleep_score_feedback = EXCLUDED.sleep_score_feedback,
  sleep_start_time_in_seconds = EXCLUDED.sleep_start_time_in_seconds,
  sleep_end_time_in_seconds = EXCLUDED.sleep_end_time_in_seconds,
  updated_at = now();
