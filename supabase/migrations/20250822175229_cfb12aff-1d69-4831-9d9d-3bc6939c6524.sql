
-- 0) Ver o tamanho atual (tabela e índices)
SELECT
  pg_size_pretty(pg_relation_size('public.garmin_activity_details')) AS table_size,
  pg_size_pretty(pg_indexes_size('public.garmin_activity_details')) AS indexes_size,
  pg_size_pretty(pg_total_relation_size('public.garmin_activity_details')) AS total_size;

-- 1) Reaproveitar espaço internamente e atualizar estatísticas (não encolhe arquivo no disco)
VACUUM (ANALYZE, VERBOSE) public.garmin_activity_details;

-- 2) Recriar índices de forma concorrente (reduz bloat de índices com impacto mínimo)
-- Se este passo travar por timeout no SQL Editor, execute em uma conexão direta (psql/DBeaver).
REINDEX TABLE CONCURRENTLY public.garmin_activity_details;

-- 3) Ver o tamanho novamente
SELECT
  pg_size_pretty(pg_relation_size('public.garmin_activity_details')) AS table_size_after,
  pg_size_pretty(pg_indexes_size('public.garmin_activity_details')) AS indexes_size_after,
  pg_size_pretty(pg_total_relation_size('public.garmin_activity_details')) AS total_size_after;

-- OPCIONAL (use somente se a tabela for 100% descartável/reconstruível):
-- TRUNCATE TABLE public.garmin_activity_details;
