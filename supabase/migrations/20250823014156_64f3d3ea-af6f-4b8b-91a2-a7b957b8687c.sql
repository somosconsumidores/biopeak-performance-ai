
-- Agenda um VACUUM FULL único para rodar em 5 minutos
-- Isso bloqueará a tabela public.garmin_activity_details durante a execução
select cron.schedule_in(
  '5 minutes',
  $$VACUUM (FULL, VERBOSE, ANALYZE) public.garmin_activity_details;$$
) as job_id;
