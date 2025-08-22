
-- 1) Função única que calcula a análise de variação direto das tabelas de detalhes
CREATE OR REPLACE FUNCTION public.calculate_variation_analysis(
  p_user_id uuid,
  p_activity_source text,
  p_activity_id text
) RETURNS void
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
  -- Normalizamos a origem para comparação
  CASE lower(p_activity_source)
    WHEN 'garmin' THEN
      WITH s AS (
        -- 1) Amostras linha-a-linha (colunas)
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

        -- 2) Fallback via JSONB samples (se existir)
        SELECT
          CASE
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL 
              THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL 
              THEN (elem->>'paceMinKm')::numeric
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
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.samples, '[]'::jsonb)) elem
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
      )
      SELECT 
        array_remove(array_agg(pace), NULL),
        array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;

    WHEN 'strava' THEN
      WITH s AS (
        -- Strava: tipicamente vem via JSON streams/samples no details
        SELECT
          CASE
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL 
              THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL 
              THEN (elem->>'paceMinKm')::numeric
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
        FROM public.strava_activity_details d
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.samples, '[]'::jsonb)) elem
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
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL 
              THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL 
              THEN (elem->>'paceMinKm')::numeric
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
        FROM public.strava_gpx_activity_details d
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.samples, '[]'::jsonb)) elem
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
      )
      SELECT 
        array_remove(array_agg(pace), NULL),
        array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;

    WHEN 'zepp_gpx' THEN
      WITH s AS (
        SELECT
          CASE
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL 
              THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL 
              THEN (elem->>'paceMinKm')::numeric
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
        FROM public.zepp_gpx_activity_details d
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.samples, '[]'::jsonb)) elem
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
      )
      SELECT 
        array_remove(array_agg(pace), NULL),
        array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;

    WHEN 'polar' THEN
      WITH s AS (
        SELECT
          CASE
            WHEN NULLIF(elem->>'pace_min_km','') IS NOT NULL 
              THEN (elem->>'pace_min_km')::numeric
            WHEN NULLIF(elem->>'paceMinKm','') IS NOT NULL 
              THEN (elem->>'paceMinKm')::numeric
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
        FROM public.polar_activity_details d
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.samples, '[]'::jsonb)) elem
        WHERE d.user_id = p_user_id
          AND d.activity_id = p_activity_id
      )
      SELECT 
        array_remove(array_agg(pace), NULL),
        array_remove(array_agg(hr), NULL)
      INTO pace_samples, hr_samples
      FROM s;
    ELSE
      -- Origem desconhecida: não faz nada
      pace_samples := NULL;
      hr_samples := NULL;
  END CASE;

  -- Cálculo dos coeficientes de variação (CV)
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

-- 2) Triggers para recalcular automaticamente AO INSERIR/ATUALIZAR

-- Garmin
CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc_garmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $func$
BEGIN
  PERFORM public.calculate_variation_analysis(NEW.user_id, 'garmin', NEW.activity_id::text);
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_variation_analysis_garmin ON public.garmin_activity_details;
CREATE TRIGGER trg_variation_analysis_garmin
AFTER INSERT OR UPDATE
ON public.garmin_activity_details
FOR EACH ROW
EXECUTE FUNCTION public.trg_variation_analysis_recalc_garmin();

-- Strava (só cria se a tabela existir)
DO $$
BEGIN
  IF to_regclass('public.strava_activity_details') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc_strava()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
    AS $f$
    BEGIN
      PERFORM public.calculate_variation_analysis(NEW.user_id, 'strava', NEW.strava_activity_id::text);
      RETURN NEW;
    END;
    $f$;

    DROP TRIGGER IF EXISTS trg_variation_analysis_strava ON public.strava_activity_details;
    CREATE TRIGGER trg_variation_analysis_strava
    AFTER INSERT OR UPDATE
    ON public.strava_activity_details
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_variation_analysis_recalc_strava();
  END IF;
END
$$;

-- Strava GPX (só cria se a tabela existir)
DO $$
BEGIN
  IF to_regclass('public.strava_gpx_activity_details') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc_strava_gpx()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
    AS $f$
    BEGIN
      PERFORM public.calculate_variation_analysis(NEW.user_id, 'strava_gpx', NEW.activity_id::text);
      RETURN NEW;
    END;
    $f$;

    DROP TRIGGER IF EXISTS trg_variation_analysis_strava_gpx ON public.strava_gpx_activity_details;
    CREATE TRIGGER trg_variation_analysis_strava_gpx
    AFTER INSERT OR UPDATE
    ON public.strava_gpx_activity_details
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_variation_analysis_recalc_strava_gpx();
  END IF;
END
$$;

-- Zepp GPX (só cria se a tabela existir)
DO $$
BEGIN
  IF to_regclass('public.zepp_gpx_activity_details') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc_zepp_gpx()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
    AS $f$
    BEGIN
      PERFORM public.calculate_variation_analysis(NEW.user_id, 'zepp_gpx', NEW.activity_id::text);
      RETURN NEW;
    END;
    $f$;

    DROP TRIGGER IF EXISTS trg_variation_analysis_zepp_gpx ON public.zepp_gpx_activity_details;
    CREATE TRIGGER trg_variation_analysis_zepp_gpx
    AFTER INSERT OR UPDATE
    ON public.zepp_gpx_activity_details
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_variation_analysis_recalc_zepp_gpx();
  END IF;
END
$$;

-- Polar (só cria se a tabela existir)
DO $$
BEGIN
  IF to_regclass('public.polar_activity_details') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc_polar()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
    AS $f$
    BEGIN
      PERFORM public.calculate_variation_analysis(NEW.user_id, 'polar', NEW.activity_id::text);
      RETURN NEW;
    END;
    $f$;

    DROP TRIGGER IF EXISTS trg_variation_analysis_polar ON public.polar_activity_details;
    CREATE TRIGGER trg_variation_analysis_polar
    AFTER INSERT OR UPDATE
    ON public.polar_activity_details
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_variation_analysis_recalc_polar();
  END IF;
END
$$;
