
-- 1) Inserir linhas faltantes em garmin_vo2max a partir de logs com VO2 presente
INSERT INTO public.garmin_vo2max (garmin_user_id, calendar_date, vo2_max_running, fitness_age)
SELECT 
  l.garmin_user_id,
  (l.payload->>'calendarDate')::date AS calendar_date,
  COALESCE(
    NULLIF(l.payload->>'vo2Max','')::numeric,
    NULLIF(l.payload->>'VO2MAX','')::numeric
  ) AS vo2_max_running,
  NULLIF(l.payload->>'fitnessAge','')::int AS fitness_age
FROM public.garmin_webhook_logs l
LEFT JOIN public.garmin_vo2max v
  ON v.garmin_user_id = l.garmin_user_id
 AND v.calendar_date = (l.payload->>'calendarDate')::date
WHERE l.webhook_type = 'user_metrics'
  AND v.id IS NULL
  AND COALESCE(
        NULLIF(l.payload->>'vo2Max',''),
        NULLIF(l.payload->>'VO2MAX','')
      ) IS NOT NULL;

-- 2) Atualizar linhas já existentes com vo2_max_running NULL usando vo2Max/VO2MAX dos logs
UPDATE public.garmin_vo2max v
SET 
  vo2_max_running = COALESCE(
    NULLIF(l.payload->>'vo2Max','')::numeric,
    NULLIF(l.payload->>'VO2MAX','')::numeric
  ),
  fitness_age = COALESCE(
    NULLIF(l.payload->>'fitnessAge','')::int,
    v.fitness_age
  )
FROM public.garmin_webhook_logs l
WHERE l.webhook_type = 'user_metrics'
  AND l.garmin_user_id = v.garmin_user_id
  AND (l.payload->>'calendarDate')::date = v.calendar_date
  AND v.vo2_max_running IS NULL
  AND COALESCE(
        NULLIF(l.payload->>'vo2Max',''),
        NULLIF(l.payload->>'VO2MAX','')
      ) IS NOT NULL;
