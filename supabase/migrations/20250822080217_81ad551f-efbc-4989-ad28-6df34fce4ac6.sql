-- Create table for variation analysis
CREATE TABLE IF NOT EXISTS public.variation_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_source text NOT NULL,
  activity_id text NOT NULL,
  data_points integer NOT NULL DEFAULT 0,
  heart_rate_cv numeric,
  heart_rate_cv_category text,
  pace_cv numeric,
  pace_cv_category text,
  diagnosis text,
  has_valid_data boolean NOT NULL DEFAULT false,
  built_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT variation_analysis_unique UNIQUE (user_id, activity_source, activity_id)
);

-- Enable RLS
ALTER TABLE public.variation_analysis ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Service role can manage all variation analysis'
  ) THEN
    CREATE POLICY "Service role can manage all variation analysis"
    ON public.variation_analysis
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Users can view their own variation analysis'
  ) THEN
    CREATE POLICY "Users can view their own variation analysis"
    ON public.variation_analysis
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Users can insert their own variation analysis'
  ) THEN
    CREATE POLICY "Users can insert their own variation analysis"
    ON public.variation_analysis
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Users can update their own variation analysis'
  ) THEN
    CREATE POLICY "Users can update their own variation analysis"
    ON public.variation_analysis
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Users can delete their own variation analysis'
  ) THEN
    CREATE POLICY "Users can delete their own variation analysis"
    ON public.variation_analysis
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_variation_analysis_updated_at'
  ) THEN
    CREATE TRIGGER trg_variation_analysis_updated_at
    BEFORE UPDATE ON public.variation_analysis
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Function to calculate variation analysis using cached chart series when available
CREATE OR REPLACE FUNCTION public.calculate_variation_analysis(
  p_user_id uuid,
  p_activity_source text,
  p_activity_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_series jsonb;
  pace_samples numeric[];
  hr_samples numeric[];
  mean_pace numeric; std_pace numeric;
  mean_hr numeric; std_hr numeric;
  pace_cv numeric; hr_cv numeric;
  pace_cat text; hr_cat text;
  dp int := 0;
  has_data boolean := false;
  diag text;
BEGIN
  -- Try to get latest built series for this activity
  SELECT series
    INTO v_series
  FROM public.activity_chart_cache
  WHERE user_id = p_user_id
    AND activity_source = p_activity_source
    AND activity_id = p_activity_id
  ORDER BY built_at DESC
  LIMIT 1;

  IF v_series IS NOT NULL AND jsonb_typeof(v_series) = 'array' THEN
    -- Extract arrays of pace (min/km) and heart_rate if present
    WITH pts AS (
      SELECT 
        NULLIF((elem->>'pace_min_km'),'')::numeric AS pace,
        NULLIF((elem->>'heart_rate'),'')::numeric AS hr
      FROM jsonb_array_elements(v_series) AS elem
    ), filtered AS (
      SELECT pace, hr FROM pts WHERE (pace IS NOT NULL AND pace > 0) OR (hr IS NOT NULL AND hr > 0)
    )
    SELECT 
      array_remove(array_agg(pace), NULL),
      array_remove(array_agg(hr), NULL)
    INTO pace_samples, hr_samples
    FROM filtered;
  END IF;

  -- Compute CVs if we have enough data (>=10 samples)
  IF pace_samples IS NOT NULL AND array_length(pace_samples,1) >= 10 THEN
    SELECT avg(val), stddev_samp(val) INTO mean_pace, std_pace FROM unnest(pace_samples) AS val WHERE val > 0;
    IF mean_pace IS NOT NULL AND std_pace IS NOT NULL AND mean_pace > 0 THEN
      pace_cv := std_pace / mean_pace;
      has_data := true;
    END IF;
  END IF;

  IF hr_samples IS NOT NULL AND array_length(hr_samples,1) >= 10 THEN
    SELECT avg(val), stddev_samp(val) INTO mean_hr, std_hr FROM unnest(hr_samples) AS val WHERE val > 0;
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

  diag := CASE 
    WHEN NOT has_data THEN 'Dados insuficientes para análise'
    ELSE 'Análise calculada automaticamente'
  END;

  INSERT INTO public.variation_analysis AS va (
    user_id, activity_source, activity_id, data_points,
    heart_rate_cv, heart_rate_cv_category,
    pace_cv, pace_cv_category,
    diagnosis, has_valid_data, built_at
  ) VALUES (
    p_user_id, p_activity_source, p_activity_id, dp,
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
END;
$$;

-- Trigger function to recalc when Garmin details change
CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only for Garmin details
  PERFORM public.calculate_variation_analysis(NEW.user_id, 'garmin', NEW.activity_id);
  RETURN NEW;
END;
$$;

-- Create trigger on garmin_activity_details (after insert/update)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'after_garmin_details_recalc_variation_analysis'
  ) THEN
    CREATE TRIGGER after_garmin_details_recalc_variation_analysis
    AFTER INSERT OR UPDATE ON public.garmin_activity_details
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_variation_analysis_recalc();
  END IF;
END $$;

-- Backfill a limited set of recent Garmin activities
DO $$
DECLARE
  rec RECORD;
  processed int := 0;
BEGIN
  FOR rec IN 
    SELECT gad.user_id, gad.activity_id
    FROM public.garmin_activity_details gad
    ORDER BY gad.created_at DESC
    LIMIT 200
  LOOP
    PERFORM public.calculate_variation_analysis(rec.user_id, 'garmin', rec.activity_id);
    processed := processed + 1;
  END LOOP;
  RAISE NOTICE 'Backfill completed for % activities', processed;
END $$;