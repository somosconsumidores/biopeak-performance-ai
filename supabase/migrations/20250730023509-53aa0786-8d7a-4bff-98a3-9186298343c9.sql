-- Desativar todos os tokens Garmin existentes que foram gerados com client ID antigo
-- Os usuários precisarão se reconectar com o novo client ID de produção

UPDATE garmin_tokens 
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true;

-- Adicionar comentário explicativo na tabela
COMMENT ON TABLE garmin_tokens IS 'Tokens migrados para produção - todos os tokens antigos foram desativados em 2025-07-30';

-- Limpar estados OAuth temporários expirados
DELETE FROM oauth_states WHERE expires_at < NOW();