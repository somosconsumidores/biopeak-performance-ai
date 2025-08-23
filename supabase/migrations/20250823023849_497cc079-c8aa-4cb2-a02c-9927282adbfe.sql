-- Fix: schedule VACUUM FULL as a single statement (no SET), to avoid "transaction block" error
DO $do$
BEGIN
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details-cleanup'); EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details',
    to_char(now() + interval '2 minutes', 'MI HH24 DD MM') || ' *',
    'VACUUM (FULL, VERBOSE, ANALYZE) public.garmin_activity_details;'
  );

  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details-cleanup',
    to_char(now() + interval '35 minutes', 'MI HH24 DD MM') || ' *',
    $$SELECT cron.unschedule('oneoff-vacuum-garmin-details'); SELECT cron.unschedule('oneoff-vacuum-garmin-details-cleanup');$$
  );
END $do$;