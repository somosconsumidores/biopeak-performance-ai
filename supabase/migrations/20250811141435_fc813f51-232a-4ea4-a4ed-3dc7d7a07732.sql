
-- 1) Tabela para armazenar VO2max e Fitness Age por usuário Garmin e data
CREATE TABLE IF NOT EXISTS public.garmin_vo2max (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garmin_user_id TEXT NOT NULL,
  calendar_date DATE NOT NULL,
  vo2_max_running NUMERIC NULL,
  vo2_max_cycling NUMERIC NULL,
  fitness_age INT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Idempotência: um registro por (garmin_user_id, calendar_date)
ALTER TABLE public.garmin_vo2max
  ADD CONSTRAINT garmin_vo2max_unique UNIQUE (garmin_user_id, calendar_date);

-- 3) Índices para consultas
CREATE INDEX IF NOT EXISTS idx_gvo2_garmin_user_id ON public.garmin_vo2max (garmin_user_id);
CREATE INDEX IF NOT EXISTS idx_gvo2_calendar_date ON public.garmin_vo2max (calendar_date);

-- 4) Segurança: habilitar RLS e permitir apenas service_role gerenciar
ALTER TABLE public.garmin_vo2max ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage garmin vo2max" ON public.garmin_vo2max;
CREATE POLICY "Service role can manage garmin vo2max"
  ON public.garmin_vo2max
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
