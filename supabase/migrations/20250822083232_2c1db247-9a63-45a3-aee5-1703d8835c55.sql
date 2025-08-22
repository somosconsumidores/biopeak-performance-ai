-- Backfill variation analysis for Garmin activities with samples
CREATE OR REPLACE FUNCTION public.backfill_garmin_variation_analysis()
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
  -- Process each unique Garmin activity with samples
  FOR activity_record IN 
    SELECT DISTINCT 
      user_id, 
      activity_id,
      COUNT(*) as samples_count
    FROM garmin_activity_details 
    WHERE samples IS NOT NULL
    GROUP BY user_id, activity_id
    HAVING COUNT(*) >= 10
  LOOP
    BEGIN
      processed_count := processed_count + 1;
      
      -- Reset variables
      pace_samples := NULL;
      hr_samples := NULL;
      pace_cv := NULL;
      hr_cv := NULL;
      pace_cat := NULL;
      hr_cat := NULL;
      has_data := false;
      
      -- Extract pace and heart rate data from samples
      WITH sample_data AS (
        SELECT 
          CASE 
            WHEN (samples->>'speedMetersPerSecond')::numeric > 0 
            THEN (1000.0 / (samples->>'speedMetersPerSecond')::numeric) / 60.0 
            ELSE NULL 
          END AS pace_min_km,
          NULLIF((samples->>'heartRate')::text, '')::numeric AS heart_rate
        FROM garmin_activity_details 
        WHERE user_id = activity_record.user_id 
          AND activity_id = activity_record.activity_id
          AND samples IS NOT NULL
      )
      SELECT 
        array_remove(array_agg(pace_min_km), NULL),
        array_remove(array_agg(heart_rate), NULL)
      INTO pace_samples, hr_samples
      FROM sample_data
      WHERE pace_min_km IS NOT NULL OR heart_rate IS NOT NULL;
      
      -- Calculate pace CV if we have enough samples
      IF pace_samples IS NOT NULL AND array_length(pace_samples, 1) >= 10 THEN
        SELECT avg(val), stddev_samp(val) 
        INTO mean_pace, std_pace 
        FROM unnest(pace_samples) AS val 
        WHERE val > 0 AND val < 30; -- Reasonable pace limits
        
        IF mean_pace IS NOT NULL AND std_pace IS NOT NULL AND mean_pace > 0 THEN
          pace_cv := std_pace / mean_pace;
          pace_cat := CASE WHEN pace_cv <= 0.15 THEN 'Baixo' ELSE 'Alto' END;
          has_data := true;
        END IF;
      END IF;
      
      -- Calculate HR CV if we have enough samples
      IF hr_samples IS NOT NULL AND array_length(hr_samples, 1) >= 10 THEN
        SELECT avg(val), stddev_samp(val) 
        INTO mean_hr, std_hr 
        FROM unnest(hr_samples) AS val 
        WHERE val > 0 AND val < 220; -- Reasonable HR limits
        
        IF mean_hr IS NOT NULL AND std_hr IS NOT NULL AND mean_hr > 0 THEN
          hr_cv := std_hr / mean_hr;
          hr_cat := CASE WHEN hr_cv <= 0.15 THEN 'Baixo' ELSE 'Alto' END;
          has_data := true;
        END IF;
      END IF;
      
      sample_count := COALESCE(array_length(pace_samples, 1), 0) + COALESCE(array_length(hr_samples, 1), 0);
      
      diag := CASE 
        WHEN NOT has_data THEN 'Dados insuficientes para análise'
        ELSE 'Backfill automático baseado em samples Garmin'
      END;
      
      -- Upsert the result
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

-- Execute the backfill
SELECT * FROM public.backfill_garmin_variation_analysis();