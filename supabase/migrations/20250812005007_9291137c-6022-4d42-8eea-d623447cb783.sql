
-- Estender a tabela com campos de fases e séries
ALTER TABLE public.polar_sleep
  ADD COLUMN IF NOT EXISTS light_sleep integer,
  ADD COLUMN IF NOT EXISTS deep_sleep integer,
  ADD COLUMN IF NOT EXISTS rem_sleep integer,
  ADD COLUMN IF NOT EXISTS total_interruption_duration integer,
  ADD COLUMN IF NOT EXISTS short_interruption_duration integer,
  ADD COLUMN IF NOT EXISTS long_interruption_duration integer,
  ADD COLUMN IF NOT EXISTS sleep_cycles integer,
  ADD COLUMN IF NOT EXISTS continuity numeric,
  ADD COLUMN IF NOT EXISTS continuity_class integer,
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS sleep_rating integer,
  ADD COLUMN IF NOT EXISTS hypnogram jsonb,
  ADD COLUMN IF NOT EXISTS heart_rate_samples jsonb;
