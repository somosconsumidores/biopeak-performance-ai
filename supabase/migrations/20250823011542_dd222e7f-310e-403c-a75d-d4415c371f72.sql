
-- Reclamando espaço e reduzindo bloat na tabela
VACUUM (FULL, VERBOSE) public.garmin_activity_details;

-- Atualizando estatísticas para melhor plano de consulta
ANALYZE VERBOSE public.garmin_activity_details;
