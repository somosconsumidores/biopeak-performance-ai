-- Retry: Minimal, robust setup for variation_analysis focusing on Garmin to avoid syntax issues

-- 1) Table
CREATE TABLE IF NOT EXISTS public.variation_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_source text NOT NULL,
  activity_id text NOT NULL,
  data_points integer NOT NULL DEFAULT 0,
  heart_rate_cv numeric,
  pace_cv numeric,
  heart_rate_cv_category text,
  pace_cv_category text,
  diagnosis text,
  has_valid_data boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT variation_analysis_unique UNIQUE (user_id, activity_source, activity_id)
);

-- 2) RLS
ALTER TABLE public.variation_analysis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Service role can manage variation analysis'
  ) THEN
    CREATE POLICY "Service role can manage variation analysis" ON public.variation_analysis
    AS PERMISSIVE FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Users can view their own variation analysis'
  ) THEN
    CREATE POLICY "Users can view their own variation analysis" ON public.variation_analysis
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Users can insert their own variation analysis'
  ) THEN
    CREATE POLICY "Users can insert their own variation analysis" ON public.variation_analysis
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Users can update their own variation analysis'
  ) THEN
    CREATE POLICY "Users can update their own variation analysis" ON public.variation_analysis
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='variation_analysis' AND policyname='Users can delete their own variation analysis'
  ) THEN
    CREATE POLICY "Users can delete their own variation analysis" ON public.variation_analysis
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3) Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_variation_analysis_updated_at') THEN
    CREATE TRIGGER trg_variation_analysis_updated_at
    BEFORE UPDATE ON public.variation_analysis
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 4) Calculator function (Garmin only for reliability)
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
  v_count int := 0;
  v_hr_avg numeric;
  v_hr_sd numeric;
  v_pace_avg numeric;
  v_pace_sd numeric;
  v_pace_cv numeric;
  v_hr_cv numeric;
  v_diag text := NULL;
  v_has_valid boolean := false;
BEGIN
  -- Only process Garmin here; others noop
  IF lower(p_activity_source) <> 'garmin' THEN
    RETURN;
  END IF;

  IF to_regclass('public.garmin_activity_details') IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE heart_rate IS NOT NULL OR speed_meters_per_second IS NOT NULL) AS cnt,
    AVG(heart_rate)::numeric AS hr_avg,
    STDDEV_POP(heart_rate)::numeric AS hr_sd,
    AVG(CASE WHEN speed_meters_per_second IS NOT NULL AND speed_meters_per_second > 0 THEN (1000.0/speed_meters_per_second)/60.0 ELSE NULL END)::numeric AS pace_avg,
    STDDEV_POP(CASE WHEN speed_meters_per_second IS NOT NULL AND speed_meters_per_second > 0 THEN (1000.0/speed_meters_per_second)/60.0 ELSE NULL END)::numeric AS pace_sd
  INTO v_count, v_hr_avg, v_hr_sd, v_pace_avg, v_pace_sd
  FROM public.garmin_activity_details
  WHERE user_id = p_user_id AND activity_id = p_activity_id;

  IF COALESCE(v_pace_avg,0) > 0 THEN
    v_pace_cv := NULLIF(v_pace_sd,0) / v_pace_avg;
  ELSE
    v_pace_cv := NULL;
  END IF;
  IF COALESCE(v_hr_avg,0) > 0 THEN
    v_hr_cv := NULLIF(v_hr_sd,0) / v_hr_avg;
  ELSE
    v_hr_cv := NULL;
  END IF;

  v_has_valid := v_count >= 10;

  v_diag := CASE 
    WHEN NOT v_has_valid THEN 'Dados insuficientes para análise'
    WHEN v_pace_cv IS NULL AND v_hr_cv IS NULL THEN 'Sem dados suficientes de velocidade/FC para calcular variação'
    ELSE concat(
      'Análise gerada automaticamente. ',
      'Pace CV: ', COALESCE(ROUND(v_pace_cv*100,1)::text,'N/A'), '%, ',
      'FC CV: ', COALESCE(ROUND(v_hr_cv*100,1)::text,'N/A'), '%.'
    )
  END;

  INSERT INTO public.variation_analysis (
    user_id, activity_source, activity_id,
    data_points, heart_rate_cv, pace_cv,
    heart_rate_cv_category, pace_cv_category,
    diagnosis, has_valid_data
  ) VALUES (
    p_user_id, p_activity_source, p_activity_id,
    COALESCE(v_count,0), v_hr_cv, v_pace_cv,
    CASE WHEN v_hr_cv IS NULL THEN NULL WHEN v_hr_cv <= 0.15 THEN 'Baixo' ELSE 'Alto' END,
    CASE WHEN v_pace_cv IS NULL THEN NULL WHEN v_pace_cv <= 0.15 THEN 'Baixo' ELSE 'Alto' END,
    v_diag, v_has_valid
  )
  ON CONFLICT (user_id, activity_source, activity_id)
  DO UPDATE SET
    data_points = EXCLUDED.data_points,
    heart_rate_cv = EXCLUDED.heart_rate_cv,
    pace_cv = EXCLUDED.pace_cv,
    heart_rate_cv_category = EXCLUDED.heart_rate_cv_category,
    pace_cv_category = EXCLUDED.pace_cv_category,
    diagnosis = EXCLUDED.diagnosis,
    has_valid_data = EXCLUDED.has_valid_data,
    updated_at = now();
END;
$$;

-- 5) Trigger on Garmin details only
DO $$
BEGIN
  IF to_regclass('public.garmin_activity_details') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_garmin_details_variation_recalc') THEN
      CREATE TRIGGER trg_garmin_details_variation_recalc
      AFTER INSERT OR UPDATE ON public.garmin_activity_details
      FOR EACH ROW EXECUTE FUNCTION public.trg_variation_analysis_recalc();
    END IF;
  END IF;
END $$;

-- Supporting trigger function
CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.calculate_variation_analysis(NEW.user_id, 'garmin', NEW.activity_id);
  RETURN NEW;
END;
$$;

-- 6) Backfill (recent 90 days, limited)
DO $$
DECLARE r record; 
BEGIN
  IF to_regclass('public.garmin_activity_details') IS NOT NULL THEN
    FOR r IN (
      SELECT DISTINCT user_id, activity_id
      FROM public.garmin_activity_details
      WHERE created_at > now() - interval '90 days'
      LIMIT 500
    ) LOOP
      PERFORM public.calculate_variation_analysis(r.user_id, 'garmin', r.activity_id);
    END LOOP;
  END IF;
END $$;