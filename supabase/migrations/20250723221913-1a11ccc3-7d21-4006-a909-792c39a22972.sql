
-- Adicionar campo para controlar se foi feita a sincronização inicial
ALTER TABLE public.garmin_tokens 
ADD COLUMN initial_sync_completed BOOLEAN DEFAULT FALSE;

-- Criar índice para otimizar consultas
CREATE INDEX idx_garmin_tokens_initial_sync ON public.garmin_tokens(user_id, initial_sync_completed);

-- Atualizar tokens existentes para marcar como tendo feito sincronização inicial
-- (assumindo que usuários com atividades já fizeram a sincronização)
UPDATE public.garmin_tokens 
SET initial_sync_completed = TRUE 
WHERE user_id IN (
  SELECT DISTINCT user_id 
  FROM public.garmin_activities 
  WHERE user_id IS NOT NULL
);
