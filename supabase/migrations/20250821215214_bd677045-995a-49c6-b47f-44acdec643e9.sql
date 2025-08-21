
-- 1) Tabela principal: variation_analysis
CREATE TABLE IF NOT EXISTS public.variation_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  activity_date date,
  activity_type text,
  activity_source text NOT NULL, -- 'garmin' | 'strava' | 'strava_gpx' | 'zepp_gpx' | 'polar' | 'zepp' (reserva)
  cv_fc numeric,   -- coeficiente de variação da FC (percentual)
  cv_pace numeric, -- coeficiente de variação do Pace (percentual)
  UNIQUE(user_id, activity_source, activity_id)
);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public._set_updated_at_variation_analysis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_variation_analysis ON public.variation_analysis;
CREATE TRIGGER trg_set_updated_at_variation_analysis
BEFORE UPDATE ON public.variation_analysis
FOR EACH ROW EXECUTE FUNCTION public._set_updated_at_variation_analysis();

-- 2) RLS
ALTER TABLE public.variation_analysis ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas os próprios registros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'variation_analysis' AND policyname = 'Users can view their own variation analysis'
  ) THEN
    CREATE POLICY "Users can view their own variation analysis"
      ON public.variation_analysis
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- Service role pode gerenciar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'variation_analysis' AND policyname = 'Service role can manage variation analysis'
  ) THEN
    CREATE POLICY "Service role can manage variation analysis"
      ON public.variation_analysis
      FOR ALL
      USING ((auth.role() = 'service_role'))
      WITH CHECK ((auth.role() = 'service_role'));
  END IF;
END$$;

-- 3) Fila de jobs
CREATE TABLE IF NOT EXISTS public.variation_analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  activity_source text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | retry | completed
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  UNIQUE(user_id, activity_source, activity_id)
);

-- updated_at
CREATE OR REPLACE FUNCTION public._set_updated_at_variation_analysis_jobs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_variation_analysis_jobs ON public.variation_analysis_jobs;
CREATE TRIGGER trg_set_updated_at_variation_analysis_jobs
BEFORE UPDATE ON public.variation_analysis_jobs
FOR EACH ROW EXECUTE FUNCTION public._set_updated_at_variation_analysis_jobs();

-- RLS na fila (apenas service role gerencia; opcionalmente usuários podem ler os próprios jobs)
ALTER TABLE public.variation_analysis_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'variation_analysis_jobs' AND policyname = 'Service role can manage variation jobs'
  ) THEN
    CREATE POLICY "Service role can manage variation jobs"
      ON public.variation_analysis_jobs
      FOR ALL
      USING ((auth.role() = 'service_role'))
      WITH CHECK ((auth.role() = 'service_role'));
  END IF;
END$$;

-- Opcional: usuários veem os próprios jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'variation_analysis_jobs' AND policyname = 'Users can view their own variation jobs'
  ) THEN
    CREATE POLICY "Users can view their own variation jobs"
      ON public.variation_analysis_jobs
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- 4) Função de enfileiramento (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.enqueue_variation_analysis_job(_user_id uuid, _activity_id text, _activity_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.variation_analysis_jobs (user_id, activity_id, activity_source, status)
  VALUES (_user_id, _activity_id, _activity_source, 'pending')
  ON CONFLICT (user_id, activity_source, activity_id) DO UPDATE
    SET status = CASE 
                   WHEN public.variation_analysis_jobs.status = 'completed' THEN 'pending'
                   ELSE public.variation_analysis_jobs.status
                 END,
        updated_at = now();
END;
$$;

-- 5) Triggers de enfileiramento por tabela de detalhes

-- Garmin
CREATE OR REPLACE FUNCTION public.trg_enqueue_variation_garmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.enqueue_variation_analysis_job(NEW.user_id, NEW.activity_id::text, 'garmin');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_variation_garmin ON public.garmin_activity_details;
CREATE TRIGGER trg_enqueue_variation_garmin
AFTER INSERT ON public.garmin_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_variation_garmin();

-- Strava (streams oficiais) - usa strava_activity_id (bigint)
CREATE OR REPLACE FUNCTION public.trg_enqueue_variation_strava()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Assumindo coluna strava_activity_id nas details
  PERFORM public.enqueue_variation_analysis_job(NEW.user_id, NEW.strava_activity_id::text, 'strava');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_variation_strava ON public.strava_activity_details;
CREATE TRIGGER trg_enqueue_variation_strava
AFTER INSERT ON public.strava_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_variation_strava();

-- Strava GPX
CREATE OR REPLACE FUNCTION public.trg_enqueue_variation_strava_gpx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.enqueue_variation_analysis_job(NEW.user_id, NEW.activity_id::text, 'strava_gpx');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_variation_strava_gpx ON public.strava_gpx_activity_details;
CREATE TRIGGER trg_enqueue_variation_strava_gpx
AFTER INSERT ON public.strava_gpx_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_variation_strava_gpx();

-- Zepp GPX
CREATE OR REPLACE FUNCTION public.trg_enqueue_variation_zepp_gpx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.enqueue_variation_analysis_job(NEW.user_id, NEW.activity_id::text, 'zepp_gpx');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_variation_zepp_gpx ON public.zepp_gpx_activity_details;
CREATE TRIGGER trg_enqueue_variation_zepp_gpx
AFTER INSERT ON public.zepp_gpx_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_variation_zepp_gpx();

-- Polar
CREATE OR REPLACE FUNCTION public.trg_enqueue_variation_polar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.enqueue_variation_analysis_job(NEW.user_id, NEW.activity_id::text, 'polar');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_variation_polar ON public.polar_activity_details;
CREATE TRIGGER trg_enqueue_variation_polar
AFTER INSERT ON public.polar_activity_details
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_variation_polar();

-- 6) Processador de jobs (sem amostragem)
CREATE OR REPLACE FUNCTION public.process_variation_analysis_jobs(max_items int DEFAULT 100)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_processed int := 0;
  r record;
  v_cv_pace numeric;
  v_cv_hr numeric;
  v_activity_date date;
  v_activity_type text;
BEGIN
  FOR r IN
    SELECT id, user_id, activity_id, activity_source, attempts
    FROM public.variation_analysis_jobs
    WHERE status IN ('pending','retry') AND attempts < 10
    ORDER BY created_at
    LIMIT max_items
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_cv_pace := NULL;
      v_cv_hr := NULL;
      v_activity_date := NULL;
      v_activity_type := NULL;

      IF r.activity_source = 'garmin' THEN
        -- Coleta metadados
        SELECT ga.activity_date, ga.activity_type
        INTO v_activity_date, v_activity_type
        FROM public.garmin_activities ga
        WHERE ga.user_id = r.user_id AND ga.activity_id = r.activity_id
        LIMIT 1;

        WITH det AS (
          SELECT sample_timestamp, total_distance_in_meters, speed_meters_per_second, heart_rate
          FROM public.garmin_activity_details
          WHERE user_id = r.user_id AND activity_id = r.activity_id
        ), calc AS (
          SELECT
            COALESCE(
              NULLIF(speed_meters_per_second, 0),
              CASE 
                WHEN total_distance_in_meters IS NOT NULL
                     AND sample_timestamp IS NOT NULL
                     AND lag(total_distance_in_meters) OVER w IS NOT NULL
                     AND lag(sample_timestamp) OVER w IS NOT NULL
                THEN
                  (total_distance_in_meters - lag(total_distance_in_meters) OVER w)
                  / NULLIF((sample_timestamp - lag(sample_timestamp) OVER w)::numeric, 0)
                ELSE NULL
              END
            ) AS speed_ms,
            heart_rate
          FROM det
          WINDOW w AS (ORDER BY sample_timestamp)
        ), speeds AS (
          SELECT (1000.0 / speed_ms) / 60.0 AS pace
          FROM calc
          WHERE speed_ms IS NOT NULL AND speed_ms > 0
        ), hrs AS (
          SELECT heart_rate AS hr
          FROM calc
          WHERE heart_rate IS NOT NULL AND heart_rate > 0
        ), agg_pace AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(pace) > 0 
                      THEN (STDDEV_SAMP(pace)/AVG(pace))*100 ELSE NULL END AS cv_pace
          FROM speeds
        ), agg_hr AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(hr) > 0 
                      THEN (STDDEV_SAMP(hr::numeric)/AVG(hr::numeric))*100 ELSE NULL END AS cv_hr
          FROM hrs
        )
        SELECT agg_pace.cv_pace, agg_hr.cv_hr
        INTO v_cv_pace, v_cv_hr
        FROM agg_pace CROSS JOIN agg_hr;

      ELSIF r.activity_source = 'strava' THEN
        SELECT sa.start_date::date, sa.type
        INTO v_activity_date, v_activity_type
        FROM public.strava_activities sa
        WHERE sa.user_id = r.user_id AND sa.strava_activity_id::text = r.activity_id
        LIMIT 1;

        WITH det AS (
          SELECT sample_timestamp, total_distance_in_meters, speed_meters_per_second, heart_rate
          FROM public.strava_activity_details
          WHERE user_id = r.user_id AND strava_activity_id::text = r.activity_id
        ), calc AS (
          SELECT
            COALESCE(
              NULLIF(speed_meters_per_second, 0),
              CASE 
                WHEN total_distance_in_meters IS NOT NULL
                     AND sample_timestamp IS NOT NULL
                     AND lag(total_distance_in_meters) OVER w IS NOT NULL
                     AND lag(sample_timestamp) OVER w IS NOT NULL
                THEN
                  (total_distance_in_meters - lag(total_distance_in_meters) OVER w)
                  / NULLIF((sample_timestamp - lag(sample_timestamp) OVER w)::numeric, 0)
                ELSE NULL
              END
            ) AS speed_ms,
            heart_rate
          FROM det
          WINDOW w AS (ORDER BY sample_timestamp)
        ), speeds AS (
          SELECT (1000.0 / speed_ms) / 60.0 AS pace
          FROM calc
          WHERE speed_ms IS NOT NULL AND speed_ms > 0
        ), hrs AS (
          SELECT heart_rate AS hr
          FROM calc
          WHERE heart_rate IS NOT NULL AND heart_rate > 0
        ), agg_pace AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(pace) > 0 
                      THEN (STDDEV_SAMP(pace)/AVG(pace))*100 ELSE NULL END AS cv_pace
          FROM speeds
        ), agg_hr AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(hr) > 0 
                      THEN (STDDEV_SAMP(hr::numeric)/AVG(hr::numeric))*100 ELSE NULL END AS cv_hr
          FROM hrs
        )
        SELECT agg_pace.cv_pace, agg_hr.cv_hr
        INTO v_cv_pace, v_cv_hr
        FROM agg_pace CROSS JOIN agg_hr;

      ELSIF r.activity_source = 'strava_gpx' THEN
        SELECT sga.start_time::date, sga.activity_type
        INTO v_activity_date, v_activity_type
        FROM public.strava_gpx_activities sga
        WHERE sga.user_id = r.user_id AND sga.activity_id = r.activity_id
        LIMIT 1;

        WITH det AS (
          SELECT sample_timestamp, total_distance_in_meters, speed_meters_per_second, heart_rate
          FROM public.strava_gpx_activity_details
          WHERE user_id = r.user_id AND activity_id = r.activity_id
        ), calc AS (
          SELECT
            COALESCE(
              NULLIF(speed_meters_per_second, 0),
              CASE 
                WHEN total_distance_in_meters IS NOT NULL
                     AND sample_timestamp IS NOT NULL
                     AND lag(total_distance_in_meters) OVER w IS NOT NULL
                     AND lag(sample_timestamp) OVER w IS NOT NULL
                THEN
                  (total_distance_in_meters - lag(total_distance_in_meters) OVER w)
                  / NULLIF((sample_timestamp - lag(sample_timestamp) OVER w)::numeric, 0)
                ELSE NULL
              END
            ) AS speed_ms,
            heart_rate
          FROM det
          WINDOW w AS (ORDER BY sample_timestamp)
        ), speeds AS (
          SELECT (1000.0 / speed_ms) / 60.0 AS pace
          FROM calc
          WHERE speed_ms IS NOT NULL AND speed_ms > 0
        ), hrs AS (
          SELECT heart_rate AS hr
          FROM calc
          WHERE heart_rate IS NOT NULL AND heart_rate > 0
        ), agg_pace AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(pace) > 0 
                      THEN (STDDEV_SAMP(pace)/AVG(pace))*100 ELSE NULL END AS cv_pace
          FROM speeds
        ), agg_hr AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(hr) > 0 
                      THEN (STDDEV_SAMP(hr::numeric)/AVG(hr::numeric))*100 ELSE NULL END AS cv_hr
          FROM hrs
        )
        SELECT agg_pace.cv_pace, agg_hr.cv_hr
        INTO v_cv_pace, v_cv_hr
        FROM agg_pace CROSS JOIN agg_hr;

      ELSIF r.activity_source = 'zepp_gpx' THEN
        SELECT zza.start_time::date, zza.activity_type
        INTO v_activity_date, v_activity_type
        FROM public.zepp_gpx_activities zza
        WHERE zza.user_id = r.user_id AND zza.activity_id = r.activity_id
        LIMIT 1;

        WITH det AS (
          SELECT sample_timestamp, total_distance_in_meters, speed_meters_per_second, heart_rate
          FROM public.zepp_gpx_activity_details
          WHERE user_id = r.user_id AND activity_id = r.activity_id
        ), calc AS (
          SELECT
            COALESCE(
              NULLIF(speed_meters_per_second, 0),
              CASE 
                WHEN total_distance_in_meters IS NOT NULL
                     AND sample_timestamp IS NOT NULL
                     AND lag(total_distance_in_meters) OVER w IS NOT NULL
                     AND lag(sample_timestamp) OVER w IS NOT NULL
                THEN
                  (total_distance_in_meters - lag(total_distance_in_meters) OVER w)
                  / NULLIF((sample_timestamp - lag(sample_timestamp) OVER w)::numeric, 0)
                ELSE NULL
              END
            ) AS speed_ms,
            heart_rate
          FROM det
          WINDOW w AS (ORDER BY sample_timestamp)
        ), speeds AS (
          SELECT (1000.0 / speed_ms) / 60.0 AS pace
          FROM calc
          WHERE speed_ms IS NOT NULL AND speed_ms > 0
        ), hrs AS (
          SELECT heart_rate AS hr
          FROM calc
          WHERE heart_rate IS NOT NULL AND heart_rate > 0
        ), agg_pace AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(pace) > 0 
                      THEN (STDDEV_SAMP(pace)/AVG(pace))*100 ELSE NULL END AS cv_pace
          FROM speeds
        ), agg_hr AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(hr) > 0 
                      THEN (STDDEV_SAMP(hr::numeric)/AVG(hr::numeric))*100 ELSE NULL END AS cv_hr
          FROM hrs
        )
        SELECT agg_pace.cv_pace, agg_hr.cv_hr
        INTO v_cv_pace, v_cv_hr
        FROM agg_pace CROSS JOIN agg_hr;

      ELSIF r.activity_source = 'polar' THEN
        SELECT pa.start_time::date, pa.activity_type
        INTO v_activity_date, v_activity_type
        FROM public.polar_activities pa
        WHERE pa.user_id = r.user_id AND pa.activity_id = r.activity_id
        LIMIT 1;

        WITH det AS (
          SELECT sample_timestamp, total_distance_in_meters, speed_meters_per_second, heart_rate
          FROM public.polar_activity_details
          WHERE user_id = r.user_id AND activity_id = r.activity_id
        ), calc AS (
          SELECT
            COALESCE(
              NULLIF(speed_meters_per_second, 0),
              CASE 
                WHEN total_distance_in_meters IS NOT NULL
                     AND sample_timestamp IS NOT NULL
                     AND lag(total_distance_in_meters) OVER w IS NOT NULL
                     AND lag(sample_timestamp) OVER w IS NOT NULL
                THEN
                  (total_distance_in_meters - lag(total_distance_in_meters) OVER w)
                  / NULLIF((sample_timestamp - lag(sample_timestamp) OVER w)::numeric, 0)
                ELSE NULL
              END
            ) AS speed_ms,
            heart_rate
          FROM det
          WINDOW w AS (ORDER BY sample_timestamp)
        ), speeds AS (
          SELECT (1000.0 / speed_ms) / 60.0 AS pace
          FROM calc
          WHERE speed_ms IS NOT NULL AND speed_ms > 0
        ), hrs AS (
          SELECT heart_rate AS hr
          FROM calc
          WHERE heart_rate IS NOT NULL AND heart_rate > 0
        ), agg_pace AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(pace) > 0 
                      THEN (STDDEV_SAMP(pace)/AVG(pace))*100 ELSE NULL END AS cv_pace
          FROM speeds
        ), agg_hr AS (
          SELECT CASE WHEN COUNT(*) > 1 AND AVG(hr) > 0 
                      THEN (STDDEV_SAMP(hr::numeric)/AVG(hr::numeric))*100 ELSE NULL END AS cv_hr
          FROM hrs
        )
        SELECT agg_pace.cv_pace, agg_hr.cv_hr
        INTO v_cv_pace, v_cv_hr
        FROM agg_pace CROSS JOIN agg_hr;

      ELSE
        -- Fonte desconhecida
        RAISE EXCEPTION 'Unknown activity_source: %', r.activity_source;
      END IF;

      -- UPSERT em variation_analysis
      INSERT INTO public.variation_analysis (
        user_id, activity_id, activity_date, activity_type, activity_source, cv_fc, cv_pace
      ) VALUES (
        r.user_id, r.activity_id, v_activity_date, v_activity_type, r.activity_source, v_cv_hr, v_cv_pace
      )
      ON CONFLICT (user_id, activity_source, activity_id) DO UPDATE
        SET activity_date = EXCLUDED.activity_date,
            activity_type = EXCLUDED.activity_type,
            cv_fc = EXCLUDED.cv_fc,
            cv_pace = EXCLUDED.cv_pace,
            updated_at = now();

      -- Marca job como concluído
      UPDATE public.variation_analysis_jobs
      SET status = 'completed', attempts = r.attempts + 1, last_error = NULL, updated_at = now()
      WHERE id = r.id;

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.variation_analysis_jobs
      SET status = 'retry', attempts = r.attempts + 1, last_error = SQLERRM, updated_at = now()
      WHERE id = r.id;
    END;
  END LOOP;

  RETURN v_processed;
END;
$$;

-- 7) Agendamento com pg_cron (executa a cada minuto)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'variation-analysis-processor') THEN
    PERFORM cron.schedule(
      'variation-analysis-processor',
      '* * * * *',
      $$select public.process_variation_analysis_jobs(200);$$
    );
  END IF;
END$$;

-- 8) Backfill: enfileira atividades que já têm details mas ainda não têm variation_analysis
CREATE OR REPLACE FUNCTION public.enqueue_missing_variation_analysis_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Garmin
  INSERT INTO public.variation_analysis_jobs (user_id, activity_id, activity_source, status)
  SELECT gad.user_id, gad.activity_id::text, 'garmin', 'pending'
  FROM (
    SELECT DISTINCT user_id, activity_id
    FROM public.garmin_activity_details
  ) gad
  LEFT JOIN public.variation_analysis va
    ON va.user_id = gad.user_id AND va.activity_id = gad.activity_id::text AND va.activity_source = 'garmin'
  WHERE va.user_id IS NULL
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  -- Strava
  INSERT INTO public.variation_analysis_jobs (user_id, activity_id, activity_source, status)
  SELECT sad.user_id, sad.strava_activity_id::text, 'strava', 'pending'
  FROM (
    SELECT DISTINCT user_id, strava_activity_id
    FROM public.strava_activity_details
  ) sad
  LEFT JOIN public.variation_analysis va
    ON va.user_id = sad.user_id AND va.activity_id = sad.strava_activity_id::text AND va.activity_source = 'strava'
  WHERE va.user_id IS NULL
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  -- Strava GPX
  INSERT INTO public.variation_analysis_jobs (user_id, activity_id, activity_source, status)
  SELECT sgad.user_id, sgad.activity_id, 'strava_gpx', 'pending'
  FROM (
    SELECT DISTINCT user_id, activity_id
    FROM public.strava_gpx_activity_details
  ) sgad
  LEFT JOIN public.variation_analysis va
    ON va.user_id = sgad.user_id AND va.activity_id = sgad.activity_id AND va.activity_source = 'strava_gpx'
  WHERE va.user_id IS NULL
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  -- Zepp GPX
  INSERT INTO public.variation_analysis_jobs (user_id, activity_id, activity_source, status)
  SELECT zgad.user_id, zgad.activity_id, 'zepp_gpx', 'pending'
  FROM (
    SELECT DISTINCT user_id, activity_id
    FROM public.zepp_gpx_activity_details
  ) zgad
  LEFT JOIN public.variation_analysis va
    ON va.user_id = zgad.user_id AND va.activity_id = zgad.activity_id AND va.activity_source = 'zepp_gpx'
  WHERE va.user_id IS NULL
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;

  -- Polar
  INSERT INTO public.variation_analysis_jobs (user_id, activity_id, activity_source, status)
  SELECT pad.user_id, pad.activity_id, 'polar', 'pending'
  FROM (
    SELECT DISTINCT user_id, activity_id
    FROM public.polar_activity_details
  ) pad
  LEFT JOIN public.variation_analysis va
    ON va.user_id = pad.user_id AND va.activity_id = pad.activity_id AND va.activity_source = 'polar'
  WHERE va.user_id IS NULL
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
END;
$$;

-- 9) (Opcional) executar um backfill inicial automático pequeno
-- Você pode rodar manualmente:
-- SELECT public.enqueue_missing_variation_analysis_jobs();
-- e então:
-- SELECT public.process_variation_analysis_jobs(500);
