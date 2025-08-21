-- Create variation_analysis table and supporting logic

-- 1) Table
CREATE TABLE IF NOT EXISTS public.variation_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  activity_source text NOT NULL CHECK (activity_source IN ('garmin','strava','strava_gpx','polar','zepp_gpx','biopeak')),
  hr_cv numeric,
  hr_category text,
  pace_cv numeric,
  pace_category text,
  diagnosis text,
  has_valid_data boolean NOT NULL DEFAULT false,
  samples_hr integer,
  samples_pace integer,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_source, activity_id)
);

-- Enable RLS
ALTER TABLE public.variation_analysis ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY IF NOT EXISTS "Service role can manage variation analysis"
ON public.variation_analysis
FOR ALL
TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY IF NOT EXISTS "Users can view their own variation analysis"
ON public.variation_analysis
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own variation analysis"
ON public.variation_analysis
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own variation analysis"
ON public.variation_analysis
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own variation analysis"
ON public.variation_analysis
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Updated at trigger
DROP TRIGGER IF EXISTS variation_analysis_set_updated_at ON public.variation_analysis;
CREATE TRIGGER variation_analysis_set_updated_at
BEFORE UPDATE ON public.variation_analysis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Calculation function
CREATE OR REPLACE FUNCTION public.calculate_variation_analysis(
  _user_id uuid,
  _activity_source text,
  _activity_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_hr double precision[] := ARRAY[]::double precision[];
  v_pace double precision[] := ARRAY[]::double precision[];
  v_has_hr boolean := false;
  v_has_speed boolean := false;
  v_avg double precision;
  v_std double precision;
  v_cv double precision;
  v_hr_cv numeric;
  v_pace_cv numeric;
  v_hr_cat text;
  v_pace_cat text;
  v_diag text;
  v_samples_hr int := 0;
  v_samples_pace int := 0;
BEGIN
  -- Load source specific details
  IF _activity_source = 'garmin' THEN
    SELECT array_agg((gad.heart_rate)::double precision) FILTER (WHERE gad.heart_rate IS NOT NULL),
           array_agg((CASE 
                          WHEN gad.speed_meters_per_second IS NOT NULL AND gad.speed_meters_per_second > 0
                            THEN (1000.0 / gad.speed_meters_per_second) / 60.0
                          ELSE NULL
                       END))
    INTO v_hr, v_pace
    FROM public.garmin_activity_details gad
    WHERE gad.user_id = _user_id AND gad.activity_id = _activity_id;

  ELSIF _activity_source = 'strava' THEN
    SELECT array_agg(hr)::double precision[], array_agg(pmin)::double precision[]
    INTO v_hr, v_pace
    FROM (
      SELECT NULLIF((sad.samples->>'heartrate')::numeric, NULL)::double precision AS hr,
             CASE
               WHEN NULLIF((sad.samples->>'velocity_smooth')::numeric, NULL) IS NOT NULL
                    AND NULLIF((sad.samples->>'velocity_smooth')::numeric, NULL) > 0
                 THEN (1000.0 / NULLIF((sad.samples->>'velocity_smooth')::numeric, NULL)) / 60.0
               ELSE NULL
             END::double precision AS pmin
      FROM public.strava_activity_details sad
      WHERE sad.user_id = _user_id AND sad.strava_activity_id::text = _activity_id
    ) s;

  ELSIF _activity_source = 'strava_gpx' THEN
    SELECT array_agg(hr)::double precision[], array_agg(pmin)::double precision[]
    INTO v_hr, v_pace
    FROM (
      SELECT sgd.heart_rate::double precision AS hr,
             CASE WHEN sgd.speed_ms IS NOT NULL AND sgd.speed_ms > 0 THEN (1000.0 / sgd.speed_ms) / 60.0 ELSE NULL END::double precision AS pmin
      FROM public.strava_gpx_activity_details sgd
      WHERE sgd.user_id = _user_id AND sgd.activity_id = _activity_id
    ) s;

  ELSIF _activity_source = 'polar' THEN
    SELECT array_agg(hr)::double precision[], array_agg(pmin)::double precision[]
    INTO v_hr, v_pace
    FROM (
      SELECT pad.heart_rate_bpm::double precision AS hr,
             CASE WHEN pad.speed_ms IS NOT NULL AND pad.speed_ms > 0 THEN (1000.0 / pad.speed_ms) / 60.0 ELSE NULL END::double precision AS pmin
      FROM public.polar_activity_details pad
      WHERE pad.user_id = _user_id AND pad.activity_id = _activity_id
    ) s;

  ELSIF _activity_source = 'zepp_gpx' THEN
    SELECT array_agg(hr)::double precision[], array_agg(pmin)::double precision[]
    INTO v_hr, v_pace
    FROM (
      SELECT zgd.heart_rate::double precision AS hr,
             CASE WHEN zgd.speed_ms IS NOT NULL AND zgd.speed_ms > 0 THEN (1000.0 / zgd.speed_ms) / 60.0 ELSE NULL END::double precision AS pmin
      FROM public.zepp_gpx_activity_details zgd
      WHERE zgd.user_id = _user_id AND zgd.activity_id = _activity_id
    ) s;
  END IF;

  v_has_hr := (v_hr IS NOT NULL AND array_length(v_hr,1) IS NOT NULL);
  v_has_speed := (v_pace IS NOT NULL AND array_length(v_pace,1) IS NOT NULL);

  -- Calculate HR CV
  IF v_has_hr THEN
    SELECT avg(x), stddev_samp(x) INTO v_avg, v_std FROM unnest(v_hr) AS t(x) WHERE x IS NOT NULL;
    IF v_avg IS NOT NULL AND v_avg > 0 AND v_std IS NOT NULL THEN
      v_cv := v_std / v_avg;
      v_hr_cv := ROUND((v_cv::numeric), 4);
      v_samples_hr := COALESCE(array_length(v_hr,1),0);
      v_hr_cat := CASE
        WHEN v_hr_cv IS NULL THEN NULL
        WHEN v_hr_cv < 0.05 THEN 'muito baixo'
        WHEN v_hr_cv < 0.10 THEN 'baixo'
        WHEN v_hr_cv < 0.15 THEN 'moderado'
        WHEN v_hr_cv < 0.20 THEN 'alto'
        ELSE 'muito alto'
      END;
    END IF;
  END IF;

  -- Calculate Pace CV
  IF v_has_speed THEN
    SELECT avg(x), stddev_samp(x) INTO v_avg, v_std FROM unnest(v_pace) AS t(x) WHERE x IS NOT NULL;
    IF v_avg IS NOT NULL AND v_avg > 0 AND v_std IS NOT NULL THEN
      v_cv := v_std / v_avg;
      v_pace_cv := ROUND((v_cv::numeric), 4);
      v_samples_pace := COALESCE(array_length(v_pace,1),0);
      v_pace_cat := CASE
        WHEN v_pace_cv IS NULL THEN NULL
        WHEN v_pace_cv < 0.05 THEN 'muito baixo'
        WHEN v_pace_cv < 0.10 THEN 'baixo'
        WHEN v_pace_cv < 0.15 THEN 'moderado'
        WHEN v_pace_cv < 0.20 THEN 'alto'
        ELSE 'muito alto'
      END;
    END IF;
  END IF;

  -- Generate diagnosis
  v_diag := CASE
    WHEN v_hr_cv IS NOT NULL AND v_pace_cv IS NOT NULL THEN
      CASE
        WHEN v_pace_cv <= 0.10 AND v_hr_cv <= 0.10 THEN 'Ritmo e esforço muito consistentes – ótima execução.'
        WHEN v_pace_cv <= 0.10 AND v_hr_cv > 0.15 THEN 'Pace estável, mas esforço variou – possível fadiga/terreno.'
        WHEN v_pace_cv > 0.15 AND v_hr_cv <= 0.10 THEN 'Esforço estável, mas pace variou – provável terreno/condições.'
        ELSE 'Variação considerável em ritmo e esforço – ajuste de estratégia recomendado.'
      END
    WHEN v_pace_cv IS NOT NULL THEN 'Diagnóstico baseado apenas no pace.'
    WHEN v_hr_cv IS NOT NULL THEN 'Diagnóstico baseado apenas na FC.'
    ELSE 'Dados insuficientes para análise.'
  END;

  -- Upsert result
  INSERT INTO public.variation_analysis (
    user_id, activity_id, activity_source, hr_cv, hr_category, pace_cv, pace_category,
    diagnosis, has_valid_data, samples_hr, samples_pace, calculated_at
  ) VALUES (
    _user_id, _activity_id, _activity_source, v_hr_cv, v_hr_cat, v_pace_cv, v_pace_cat,
    v_diag, (v_hr_cv IS NOT NULL OR v_pace_cv IS NOT NULL), v_samples_hr, v_samples_pace, now()
  )
  ON CONFLICT (user_id, activity_source, activity_id)
  DO UPDATE SET
    hr_cv = EXCLUDED.hr_cv,
    hr_category = EXCLUDED.hr_category,
    pace_cv = EXCLUDED.pace_cv,
    pace_category = EXCLUDED.pace_category,
    diagnosis = EXCLUDED.diagnosis,
    has_valid_data = EXCLUDED.has_valid_data,
    samples_hr = EXCLUDED.samples_hr,
    samples_pace = EXCLUDED.samples_pace,
    calculated_at = EXCLUDED.calculated_at,
    updated_at = now();
END;
$$;