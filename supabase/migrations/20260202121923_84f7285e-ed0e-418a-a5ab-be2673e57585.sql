-- Tabela para armazenar segmentação de atletas
CREATE TABLE public.athlete_segmentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Segmento principal
  segment_name TEXT NOT NULL,
  badge_icon TEXT NOT NULL,
  badge_color TEXT NOT NULL,
  
  -- Explicação gerada por IA
  ai_explanation TEXT NOT NULL,
  
  -- Snapshot das métricas usadas na análise
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  
  -- Score composto (0-100) para ordenação/comparação
  composite_score NUMERIC(5,2),
  
  -- Tendência: up, down, stable
  trend TEXT NOT NULL DEFAULT 'stable',
  
  -- Período analisado
  analysis_period_start DATE,
  analysis_period_end DATE,
  
  -- Data da segmentação (para unique constraint)
  segmentation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: um registro por usuário por semana
  UNIQUE(user_id, segmentation_date)
);

-- Comentários para documentação
COMMENT ON TABLE public.athlete_segmentation IS 'Segmentação semanal de atletas com classificação por IA';
COMMENT ON COLUMN public.athlete_segmentation.segment_name IS 'Nome do segmento: Rising Star, Consistent Performer, Comeback Hero, etc.';
COMMENT ON COLUMN public.athlete_segmentation.metrics_snapshot IS 'JSON com métricas usadas na análise: weekly_distance_km, pace_improvement, etc.';

-- Index para busca rápida do último registro por usuário
CREATE INDEX idx_athlete_segmentation_user_latest 
  ON public.athlete_segmentation(user_id, created_at DESC);

-- Index para buscar por segmento (analytics)
CREATE INDEX idx_athlete_segmentation_segment 
  ON public.athlete_segmentation(segment_name, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.athlete_segmentation ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver apenas suas próprias segmentações
CREATE POLICY "Users can read own segmentation"
  ON public.athlete_segmentation 
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role pode inserir (usado pela Edge Function)
CREATE POLICY "Service role can insert segmentation"
  ON public.athlete_segmentation 
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service role pode atualizar
CREATE POLICY "Service role can update segmentation"
  ON public.athlete_segmentation 
  FOR UPDATE
  USING (true);

-- Grant permissions
GRANT SELECT ON public.athlete_segmentation TO authenticated;
GRANT ALL ON public.athlete_segmentation TO service_role;