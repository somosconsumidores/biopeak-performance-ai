
-- Maintenance plan:
-- - Temporarily disable statement timeout for role 'postgres' (used by pg_cron).
-- - Run a one-off VACUUM FULL on public.garmin_activity_details.
-- - Restore the role's statement timeout to 2min automatically and unschedule helper jobs.

DO $do$
BEGIN
  -- 1) Best-effort unschedule old jobs
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details-cleanup'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 2) Temporarily disable statement timeout for the 'postgres' role (pg_cron sessions inherit this)
  EXECUTE 'ALTER ROLE postgres SET statement_timeout = ''0''';

  -- 3) One-off VACUUM FULL in ~2 minutes
  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details',
    to_char(now() + interval '2 minutes', 'MI HH24 DD MM') || ' *',
    'VACUUM (FULL, VERBOSE, ANALYZE) public.garmin_activity_details;'
  );

  -- 4) Safety cleanup in 90 minutes: restore timeout and unschedule jobs
  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details-cleanup',
    to_char(now() + interval '90 minutes', 'MI HH24 DD MM') || ' *',
    $$ALTER ROLE postgres SET statement_timeout = '2min';
      SELECT cron.unschedule('oneoff-vacuum-garmin-details');
      SELECT cron.unschedule('oneoff-vacuum-garmin-details-cleanup');$$
  );
END $do$;
