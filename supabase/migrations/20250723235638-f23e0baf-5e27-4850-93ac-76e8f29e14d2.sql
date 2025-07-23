
-- Remover o cron job problemático que está causando as chamadas não solicitadas
SELECT cron.unschedule('sync-garmin-dailies');

-- Adicionar o campo initial_sync_completed à tabela garmin_tokens se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'garmin_tokens' 
                   AND column_name = 'initial_sync_completed') THEN
        ALTER TABLE public.garmin_tokens 
        ADD COLUMN initial_sync_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Atualizar tokens existentes para marcar como sync inicial já realizado
-- (para evitar backfill desnecessário em usuários já conectados)
UPDATE public.garmin_tokens 
SET initial_sync_completed = TRUE 
WHERE initial_sync_completed IS NULL OR initial_sync_completed = FALSE;

-- Comentar a função de sync automático para evitar uso acidental
COMMENT ON FUNCTION public.sync_all_users_dailies() IS 'DEPRECATED: Esta função causava chamadas não solicitadas à API Garmin. Usar apenas webhooks para sincronização.';
