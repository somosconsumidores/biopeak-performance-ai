-- Tabela para armazenar stats de evolução pré-calculadas por usuário
CREATE TABLE public.user_evolution_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  stats_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_evolution_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own stats
CREATE POLICY "Users can read own evolution stats"
ON public.user_evolution_stats
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Service role can insert/update (for edge function)
CREATE POLICY "Service can manage evolution stats"
ON public.user_evolution_stats
FOR ALL
USING (true)
WITH CHECK (true);

-- Index for fast user lookups
CREATE INDEX idx_user_evolution_stats_user_id ON public.user_evolution_stats(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_evolution_stats_updated_at
BEFORE UPDATE ON public.user_evolution_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();