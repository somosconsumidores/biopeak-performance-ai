
-- Reconstroi todos os índices da tabela sem bloquear leituras/escritas
REINDEX (VERBOSE) TABLE CONCURRENTLY public.garmin_activity_details;

-- Atualiza estatísticas após a reconstrução dos índices
ANALYZE VERBOSE public.garmin_activity_details;
