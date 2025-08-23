
DO $do$
BEGIN
  -- 1) Tenta remover jobs anteriores com estes nomes (idempotente)
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details-2'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details-2-cleanup'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 2) Desativa temporariamente o statement_timeout para sessões do pg_cron
  EXECUTE 'ALTER ROLE postgres SET statement_timeout = ''0''';

  -- 3) Agenda o VACUUM FULL para rodar em ~1 minuto
  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details-2',
    to_char(now() + interval '1 minute', 'MI HH24 DD MM') || ' *',
    'VACUUM (FULL, VERBOSE, ANALYZE) public.garmin_activity_details;'
  );

  -- 4) Cleanup de segurança em ~90 minutos: restaura o timeout e remove os jobs
  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details-2-cleanup',
    to_char(now() + interval '90 minutes', 'MI HH24 DD MM') || ' *',
    $$ALTER ROLE postgres SET statement_timeout = '2min';
      SELECT cron.unschedule('oneoff-vacuum-garmin-details-2');
      SELECT cron.unschedule('oneoff-vacuum-garmin-details-2-cleanup');$$
  );
END $do$;
