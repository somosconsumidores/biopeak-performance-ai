
-- Adicionar campo detected_workout_type na tabela all_activities
ALTER TABLE public.all_activities 
ADD COLUMN IF NOT EXISTS detected_workout_type text;

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_all_activities_detected_workout_type 
ON public.all_activities(detected_workout_type);

-- Criar índice composto para otimizar as consultas por usuário
CREATE INDEX IF NOT EXISTS idx_all_activities_user_classification 
ON public.all_activities(user_id, detected_workout_type);
