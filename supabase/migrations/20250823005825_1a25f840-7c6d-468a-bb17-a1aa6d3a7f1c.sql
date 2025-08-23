
-- Corrige a função para que o caso 'strava' use as colunas por amostra de strava_activity_details
CREATE OR REPLACE FUNCTION public.calculate_variation_analysis(p_user_id uuid, p_activity_source text, p_activity_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pace_samples numeric[];
  hr_samples numeric[];
  mean_pace numeric; std_pace numeric;
  mean_hr numeric; std_hr numeric;
  pace_cv numeric; hr_cv numeric;
  pace_cat text; hr_cat text;
  dp int := 0;
  has_data boolean := false;
BEGIN
  -- Normalize source
  CASE lower(p_activity_source)
    WHEN 'garmin' THEN
      WITH s AS (
        -- 1) Column-based samples
        SELECT 
          CASE 
            WHEN d.speed_meters_per_second IS NOT NULL AND d.speed_meters_per_second > 0
              THEN 1000.0 / (d.speed_meters_per_second * 60.0) 
            ELSE NULL 
          END AS pace,
          CASE 
            WHEN d.heart_rate IS NOT NULL AND d.heart_rate > 0 
              THEN d.heart_rate::numeric 
            ELSE NULL 
          END AS hr
        FROM public.garmin_activity_details d
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
        
        UNION ALL
        
        -- 2) JSONB fallback (supports array or object)
        SELECT
          CASE
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL THEN (elem->>'paceMinKm')::numeric
            WHEN NULLIF(elem->>'speed','') IS NOT NULL AND (elem->>'speed')::numeric > 0
              THEN 1000.0 / ((elem->>'speed')::numeric * 60.0)
            WHEN NULLIF(elem->>'speed_ms','') IS NOT NULL AND (elem->>'speed_ms')::numeric > 0
              THEN 1000.0 / ((elem->>'speed_ms')::numeric * 60.0)
            WHEN NULLIF(elem->>'velocity_smooth','') IS NOT NULL AND (elem->>'velocity_smooth')::numeric > 0
              THEN 1000.0 / ((elem->>'velocity_smooth')::numeric * 60.0)
            ELSE NULL
          END AS pace,
          COALESCE(
            NULLIF(elem->>'heart_rate','')::numeric,
            NULLIF(elem->>'heartrate','')::numeric,
            NULLIF(elem->>'hr','')::numeric
          ) AS hr
        FROM public.garmin_activity_details d
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(d.samples) = 'array' THEN d.samples
            WHEN jsonb_typeof(d.samples) = 'object' THEN jsonb_build_array(d.samples)
            ELSE '[]'::jsonb
          END
        ) elem
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
      )
      SELECT 
        array_remove(array_agg(pace), NULL),
        array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;

    WHEN 'strava' THEN
      -- Corrigido: usa as colunas por amostra de strava_activity_details,
      -- sem depender de d.samples (que não existe nesta tabela)
      WITH s AS (
        SELECT
          CASE
            WHEN d.velocity_smooth IS NOT NULL AND d.velocity_smooth > 0
              THEN 1000.0 / (d.velocity_smooth * 60.0)
            ELSE NULL
          END AS pace,
          CASE
            WHEN d.heartrate IS NOT NULL AND d.heartrate > 0
              THEN d.heartrate::numeric
            ELSE NULL
          END AS hr
        FROM public.strava_activity_details d
        WHERE d.user_id = p_user_id
          AND d.strava_activity_id::text = p_activity_id
      )
      SELECT 
        array_remove(array_agg(pace), NULL), 
        array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;

    WHEN 'strava_gpx' THEN
      WITH s AS (
        SELECT
          CASE
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL THEN (elem->>'paceMinKm')::numeric
            WHEN NULLIF(elem->>'speed','') IS NOT NULL AND (elem->>'speed')::numeric > 0 THEN 1000.0 / ((elem->>'speed')::numeric * 60.0)
            WHEN NULLIF(elem->>'speed_ms','') IS NOT NULL AND (elem->>'speed_ms')::numeric > 0 THEN 1000.0 / ((elem->>'speed_ms')::numeric * 60.0)
            WHEN NULLIF(elem->>'velocity_smooth','') IS NOT NULL AND (elem->>'velocity_smooth')::numeric > 0 THEN 1000.0 / ((elem->>'velocity_smooth')::numeric * 60.0)
            ELSE NULL
          END AS pace,
          COALESCE(NULLIF(elem->>'heart_rate','')::numeric, NULLIF(elem->>'heartrate','')::numeric, NULLIF(elem->>'hr','')::numeric) AS hr
        FROM public.strava_gpx_activity_details d
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(d.samples) = 'array' THEN d.samples
            WHEN jsonb_typeof(d.samples) = 'object' THEN jsonb_build_array(d.samples)
            ELSE '[]'::jsonb
          END
        ) elem
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
      )
      SELECT array_remove(array_agg(pace), NULL), array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;

    WHEN 'zepp_gpx' THEN
      WITH s AS (
        SELECT
          CASE
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL THEN (elem->>'paceMinKm')::numeric
            WHEN NULLIF(elem->>'speed','') IS NOT NULL AND (elem->>'speed')::numeric > 0 THEN 1000.0 / ((elem->>'speed')::numeric * 60.0)
            WHEN NULLIF(elem->>'speed_ms','') IS NOT NULL AND (elem->>'speed_ms')::numeric > 0 THEN 1000.0 / ((elem->>'speed_ms')::numeric * 60.0)
            WHEN NULLIF(elem->>'velocity_smooth','') IS NOT NULL AND (elem->>'velocity_smooth')::numeric > 0 THEN 1000.0 / ((elem->>'velocity_smooth')::numeric * 60.0)
            ELSE NULL
          END AS pace,
          COALESCE(NULLIF(elem->>'heart_rate','')::numeric, NULLIF(elem->>'heartrate','')::numeric, NULLIF(elem->>'hr','')::numeric) AS hr
        FROM public.zepp_gpx_activity_details d
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(d.samples) = 'array' THEN d.samples
            WHEN jsonb_typeof(d.samples) = 'object' THEN jsonb_build_array(d.samples)
            ELSE '[]'::jsonb
          END
        ) elem
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
      )
      SELECT array_remove(array_agg(pace), NULL), array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;

    WHEN 'polar' THEN
      WITH s AS (
        SELECT
          CASE
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL THEN (elem->>'paceMinKm')::numeric
            WHEN NULLIF(elem->>'speed','') IS NOT NULL AND (elem->>'speed')::numeric > 0 THEN 1000.0 / ((elem->>'speed')::numeric * 60.0)
            WHEN NULLIF(elem->>'speed_ms','') IS NOT NULL AND (elem->>'speed_ms')::numeric > 0 THEN 1000.0 / ((elem->>'speed_ms')::numeric * 60.0)
            WHEN NULLIF(elem->>'velocity_smooth','') IS NOT NULL AND (elem->>'velocity_smooth')::numeric > 0 THEN 1000.0 / ((elem->>'velocity_smooth')::numeric * 60.0)
            ELSE NULL
          END AS pace,
          COALESCE(NULLIF(elem->>'heart_rate','')::numeric, NULLIF(elem->>'heartrate','')::numeric, NULLIF(elem->>'hr','')::numeric) AS hr
        FROM public.polar_activity_details d
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(d.samples) = 'array' THEN d.samples
            WHEN jsonb_typeof(d.samples) = 'object' THEN jsonb_build_array(d.samples)
            ELSE '[]'::jsonb
          END
        ) elem
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
      )
      SELECT array_remove(array_agg(pace), NULL), array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;
    ELSE
      pace_samples := NULL;
      hr_samples := NULL;
  END CASE;

  -- Compute CVs
  IF pace_samples IS NOT NULL AND array_length(pace_samples,1) >= 10 THEN
    SELECT avg(val), stddev_samp(val)
    INTO mean_pace, std_pace
    FROM unnest(pace_samples) AS val
    WHERE val > 0;
    IF mean_pace IS NOT NULL AND std_pace IS NOT NULL AND mean_pace > 0 THEN
      pace_cv := std_pace / mean_pace;
      has_data := true;
    END IF;
  END IF;

  IF hr_samples IS NOT NULL AND array_length(hr_samples,1) >= 10 THEN
    SELECT avg(val), stddev_samp(val)
    INTO mean_hr, std_hr
    FROM unnest(hr_samples) AS val
    WHERE val > 0;
    IF mean_hr IS NOT NULL AND std_hr IS NOT NULL AND mean_hr > 0 THEN
      hr_cv := std_hr / mean_hr;
      has_data := true;
    END IF;
  END IF;

  dp := COALESCE(array_length(pace_samples,1),0) + COALESCE(array_length(hr_samples,1),0);

  IF hr_cv IS NOT NULL THEN
    hr_cat := CASE WHEN hr_cv <= 0.15 THEN 'Baixo' ELSE 'Alto' END;
  END IF;
  IF pace_cv IS NOT NULL THEN
    pace_cat := CASE WHEN pace_cv <= 0.15 THEN 'Baixo' ELSE 'Alto' END;
  END IF;

  INSERT INTO public.variation_analysis AS va (
    user_id, activity_source, activity_id, data_points,
    heart_rate_cv, heart_rate_cv_category,
    pace_cv, pace_cv_category,
    diagnosis, has_valid_data, built_at
  ) VALUES (
    p_user_id, lower(p_activity_source), p_activity_id, dp,
    hr_cv, hr_cat,
    pace_cv, pace_cat,
    CASE WHEN has_data THEN 'Análise calculada automaticamente' ELSE 'Dados insuficientes para análise' END,
    has_data, now()
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
END;
$function$;
