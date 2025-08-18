
-- 1) Adiciona a coluna vo2_max (se ainda não existir)
ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS vo2_max numeric;

-- 2) Cria/atualiza a função de trigger para calcular VO2 para Strava
CREATE OR REPLACE FUNCTION public.auto_calculate_vo2_max_strava()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pace_min_km numeric;
BEGIN
  -- Só calcula para atividades de corrida (qualquer variação contendo 'run')
  IF NEW.type IS NULL OR LOWER(NEW.type) NOT LIKE '%run%' THEN
    NEW.vo2_max := NULL;
    RETURN NEW;
  END IF;

  -- Deriva o pace (min/km)
  -- Opção 1: average_speed (m/s) -> pace_min_km = (1000 / m/s) / 60
  IF NEW.average_speed IS NOT NULL AND NEW.average_speed > 0 THEN
    pace_min_km := (1000.0 / NEW.average_speed) / 60.0;

  -- Opção 2: distance (m) e moving_time (s) -> pace_min_km = (moving_time/60) / (distance/1000)
  ELSIF NEW.distance IS NOT NULL AND NEW.distance > 0
     AND NEW.moving_time IS NOT NULL AND NEW.moving_time > 0 THEN
    pace_min_km := (NEW.moving_time::numeric / 60.0) / (NEW.distance::numeric / 1000.0);

  ELSE
    pace_min_km := NULL;
  END IF;

  -- Calcula VO2 somente se tivermos dados suficientes
  IF pace_min_km IS NOT NULL
     AND NEW.average_heartrate IS NOT NULL AND NEW.average_heartrate > 0
     AND NEW.max_heartrate IS NOT NULL AND NEW.max_heartrate > 0 THEN
    NEW.vo2_max := public.calculate_vo2_max(
      NEW.type,
      pace_min_km,
      NEW.average_heartrate,
      NEW.max_heartrate
    );
  ELSE
    NEW.vo2_max := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Triggers: remove se existirem e recria
DROP TRIGGER IF EXISTS strava_auto_vo2max_ins ON public.strava_activities;
DROP TRIGGER IF EXISTS strava_auto_vo2max_upd ON public.strava_activities;

CREATE TRIGGER strava_auto_vo2max_ins
BEFORE INSERT ON public.strava_activities
FOR EACH ROW
EXECUTE FUNCTION public.auto_calculate_vo2_max_strava();

-- Recalcula quando campos relevantes mudarem
CREATE TRIGGER strava_auto_vo2max_upd
BEFORE UPDATE ON public.strava_activities
FOR EACH ROW
WHEN (
  OLD.type IS DISTINCT FROM NEW.type OR
  OLD.average_heartrate IS DISTINCT FROM NEW.average_heartrate OR
  OLD.max_heartrate IS DISTINCT FROM NEW.max_heartrate OR
  OLD.average_speed IS DISTINCT FROM NEW.average_speed OR
  OLD.distance IS DISTINCT FROM NEW.distance OR
  OLD.moving_time IS DISTINCT FROM NEW.moving_time
)
EXECUTE FUNCTION public.auto_calculate_vo2_max_strava();

-- 4) Backfill: calcula vo2_max para atividades já existentes do tipo Run
UPDATE public.strava_activities sa
SET vo2_max = public.calculate_vo2_max(
  sa.type,
  CASE
    WHEN sa.average_speed IS NOT NULL AND sa.average_speed > 0
      THEN (1000.0 / sa.average_speed) / 60.0
    WHEN sa.distance IS NOT NULL AND sa.distance > 0
      AND sa.moving_time IS NOT NULL AND sa.moving_time > 0
      THEN (sa.moving_time::numeric / 60.0) / (sa.distance::numeric / 1000.0)
    ELSE NULL
  END,
  sa.average_heartrate,
  sa.max_heartrate
)
WHERE LOWER(sa.type) LIKE '%run%';
