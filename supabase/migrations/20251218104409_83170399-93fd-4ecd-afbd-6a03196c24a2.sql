-- Fase 3: Prevenção futura - Adicionar unique constraint para garmin_user_id ativo

-- Criar índice único parcial para garantir que cada garmin_user_id só tenha UM token ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_garmin_tokens_unique_active_garmin_user 
ON garmin_tokens (garmin_user_id) 
WHERE is_active = true;