-- 1) Drop old function without pagination if it exists
DROP FUNCTION IF EXISTS public.backfill_garmin_variation_analysis();

-- 2) Create robust, paginated backfill for Garmin variation analysis
CREATE OR REPLACE FUNCTION public.backfill_garmin_variation_analysis(
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(processed_activities INTEGER, successful_calculations INTEGER, failed_calculations INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  activity_record RECORD;
  pace_samples numeric[];
  hr_samples numeric[];
  mean_pace numeric; std_pace numeric;
  mean_hr numeric; std_hr numeric;
  pace_cv numeric; hr_cv numeric;
  pace_cat text; hr_cat text;
  sample_count integer;
  has_data boolean;
  diag text;
  processed_count integer := 0;
  success_count integer := 0;
  error_count integer := 0;
BEGIN
  -- Iterate distinct activities in a paginated fashion to avoid timeouts
  FOR activity_record IN 
    SELECT user_id, activity_id
    FROM (
      SELECT DISTINCT gad.user_id, gad.activity_id
      FROM public.garmin_activity_details gad
      WHERE gad.user_id IS NOT NULL AND gad.activity_id IS NOT NULL
      ORDER BY gad.user_id, gad.activity_id
      LIMIT p_limit OFFSET p_offset
    ) AS distinct_activities
  LOOP
    BEGIN
      processed_count := processed_count + 1;

      -- Reset variables per-activity
      pace_samples := NULL;
      hr_samples := NULL;
      pace_cv := NULL;
      hr_cv := NULL;
      pace_cat := NULL;
      hr_cat := NULL;
      has_data := false;

      -- Build unified sample data from two possible storage shapes:
      -- A) native columns per-row (speed_meters_per_second, heart_rate)
      -- B) JSONB array in "samples" with keys like speedMetersPerSecond/heartRate or snake_case
      WITH native_points AS (
        SELECT 
          CASE 
            WHEN gad.speed_meters_per_second IS NOT NULL AND gad.speed_meters_per_second > 0
              THEN (1000.0 / gad.speed_meters_per_second) / 60.0
            ELSE NULL
          END AS pace_min_km,
          CASE 
            WHEN gad.heart_rate IS NOT NULL AND gad.heart_rate > 0 THEN gad.heart_rate::numeric
            ELSE NULL
          END AS heart_rate
        FROM public.garmin_activity_details gad
        WHERE gad.user_id = activity_record.user_id 
          AND gad.activity_id = activity_record.activity_id
      ), json_points AS (
        SELECT 
          -- Prefer camelCase, fallback to snake_case
          CASE 
            WHEN (elem->>'speedMetersPerSecond') ~ '^[0-9]+(\.[0-9]+)?$' AND (elem->>'speedMetersPerSecond')::numeric > 0
              THEN (1000.0 / (elem->>'speedMetersPerSecond')::numeric) / 60.0
            WHEN (elem->>'speed_meters_per_second') ~ '^[0-9]+(\.[0-9]+)?$' AND (elem->>'speed_meters_per_second')::numeric > 0
              THEN (1000.0 / (elem->>'speed_meters_per_second')::numeric) / 60.0
            ELSE NULL
          END AS pace_min_km,
          CASE 
            WHEN (elem->>'heartRate') ~ '^[0-9]+$' AND (elem->>'heartRate')::int > 0
              THEN (elem->>'heartRate')::numeric
            WHEN (elem->>'heart_rate') ~ '^[0-9]+$' AND (elem->>'heart_rate')::int > 0
              THEN (elem->>'heart_rate')::numeric
            ELSE NULL
          END AS heart_rate
        FROM public.garmin_activity_details gad
        CROSS JOIN LATERAL jsonb_array_elements(gad.samples) AS elem
        WHERE gad.user_id = activity_record.user_id 
          AND gad.activity_id = activity_record.activity_id
          AND gad.samples IS NOT NULL
          AND jsonb_typeof(gad.samples) = 'array'
      ), all_points AS (
        SELECT pace_min_km, heart_rate FROM native_points
        UNION ALL
        SELECT pace_min_km, heart_rate FROM json_points
      )
      SELECT 
        array_remove(array_agg(pace_min_km), NULL),
        array_remove(array_agg(heart_rate), NULL)
      INTO pace_samples, hr_samples
      FROM all_points
      WHERE pace_min_km IS NOT NULL OR heart_rate IS NOT NULL;

      -- Calculate pace CV if enough valid samples
      IF pace_samples IS NOT NULL AND array_length(pace_samples, 1) >= 10 THEN
        SELECT avg(val), stddev_samp(val)
        INTO mean_pace, std_pace
        FROM unnest(pace_samples) AS val
        WHERE val > 0 AND val < 30; -- reasonable pace bounds (min/km)

        IF mean_pace IS NOT NULL AND std_pace IS NOT NULL AND mean_pace > 0 THEN
          pace_cv := std_pace / mean_pace;
          pace_cat := CASE WHEN pace_cv <= 0.15 THEN 'Baixo' ELSE 'Alto' END;
          has_data := true;
        END IF
      END IF;

      -- Calculate HR CV if enough valid samples
      IF hr_samples IS NOT NULL AND array_length(hr_samples, 1) >= 10 THEN
        SELECT avg(val), stddev_samp(val)
        INTO mean_hr, std_hr
        FROM unnest(hr_samples) AS val
        WHERE val > 30 AND val < 220; -- reasonable HR bounds

        IF mean_hr IS NOT NULL AND std_hr IS NOT NULL AND mean_hr > 0 THEN
          hr_cv := std_hr / mean_hr;
          hr_cat := CASE WHEN hr_cv <= 0.15 THEN 'Baixo' ELSE 'Alto' END;
          has_data := true;
        END IF
      END IF;

      sample_count := COALESCE(array_length(pace_samples, 1), 0) + COALESCE(array_length(hr_samples, 1), 0);

      diag := CASE 
        WHEN NOT has_data THEN 'Dados insuficientes para análise'
        ELSE 'Backfill automático baseado em dados Garmin (nativo/JSON)'
      END;

      -- Upsert result into variation_analysis
      INSERT INTO public.variation_analysis (
        user_id, activity_source, activity_id, data_points,
        heart_rate_cv, heart_rate_cv_category,
        pace_cv, pace_cv_category,
        diagnosis, has_valid_data, built_at
      ) VALUES (
        activity_record.user_id, 'garmin', activity_record.activity_id, sample_count,
        hr_cv, hr_cat,
        pace_cv, pace_cat,
        diag, has_data, now()
      )
      ON CONFLICT (user_id, activity_source, activity_id) DO UPDATE
      SET data_points = EXCLUDED.data_points,
          heart_rate_cv = EXCLUDED.heart_rate_cv,
          heart_rate_cv_category = EXCLUDED.heart_rate_cv_category,
          pace_cv = EXCLUDED.pace_cv,
          pace_cv_category = EXCLUDED.pace_cv_category,
          diagnosis = EXCLUDED.diagnosis,
          has_valid_data = EXCLUDED.has_valid_data,
          built_at = EXCLUDED.built_at,
          updated_at = now();

      success_count := success_count + 1;

    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE NOTICE 'Error processing activity % for user %: %', 
        activity_record.activity_id, activity_record.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT processed_count, success_count, error_count;
END;
$$;

-- 3) Execute first batch
SELECT * FROM public.backfill_garmin_variation_analysis(1000, 0);
