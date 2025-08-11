
-- Tabela de amostras de frequência cardíaca contínua (CHR) por dia
CREATE TABLE IF NOT EXISTS public.polar_continuous_hr_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  polar_user_id BIGINT,
  calendar_date DATE NOT NULL,
  sample_time TIME NOT NULL,
  heart_rate INTEGER NOT NULL,
  -- Combina a data e a hora da amostra; armazenada em UTC
  sample_timestamp TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (((calendar_date::timestamp + sample_time) AT TIME ZONE 'UTC')) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.polar_continuous_hr_samples ENABLE ROW LEVEL SECURITY;

-- Políticas: o próprio usuário pode gerenciar seus dados
CREATE POLICY "Users can view their own polar CHR samples"
  ON public.polar_continuous_hr_samples
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own polar CHR samples"
  ON public.polar_continuous_hr_samples
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own polar CHR samples"
  ON public.polar_continuous_hr_samples
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own polar CHR samples"
  ON public.polar_continuous_hr_samples
  FOR DELETE
  USING (auth.uid() = user_id);

-- Idempotência: uma amostra por usuário/data/horário
CREATE UNIQUE INDEX IF NOT EXISTS idx_polar_chr_samples_unique
  ON public.polar_continuous_hr_samples (user_id, calendar_date, sample_time);

-- Índices úteis de consulta
CREATE INDEX IF NOT EXISTS idx_polar_chr_user_date
  ON public.polar_continuous_hr_samples (user_id, calendar_date);

CREATE INDEX IF NOT EXISTS idx_polar_chr_polar_date
  ON public.polar_continuous_hr_samples (polar_user_id, calendar_date);

-- Trigger para manter updated_at
DROP TRIGGER IF EXISTS trg_polar_chr_samples_updated_at ON public.polar_continuous_hr_samples;
CREATE TRIGGER trg_polar_chr_samples_updated_at
BEFORE UPDATE ON public.polar_continuous_hr_samples
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
