-- Desativar todos os tokens Garmin existentes que foram gerados com client ID antigo
-- Os usuários precisarão se reconectar com o novo client ID de produção

UPDATE garmin_tokens 
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true;

-- Adicionar comentário explicativo na tabela sobre a troca de ambiente
COMMENT ON TABLE garmin_tokens IS 'Tokens migrados para produção - todos os tokens antigos foram desativados';

-- Limpar estados OAuth temporários expirados
DELETE FROM oauth_states WHERE expires_at < NOW();

-- Log da migração
INSERT INTO garmin_sync_control (
    sync_type,
    triggered_by,
    status,
    webhook_payload,
    created_at
) VALUES (
    'token_migration',
    'production_migration',
    'completed',
    jsonb_build_object(
        'action', 'deactivate_old_tokens',
        'reason', 'client_id_change_for_production',
        'timestamp', NOW()
    ),
    NOW()
);