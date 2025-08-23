-- Reschedule one-off VACUUM FULL with statement_timeout=0 to avoid cron session timeout
DO $do$
DECLARE
  ts timestamptz := now() + interval '2 minutes';
  sched text := to_char(ts, 'MI HH24 DD MM') || ' *';
  cleanup_ts timestamptz := ts + interval '30 minutes';
  cleanup_sched text := to_char(cleanup_ts, 'MI HH24 DD MM') || ' *';
BEGIN
  -- Unschedule previous jobs if they exist
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details-cleanup'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Schedule with explicit statement_timeout = 0, then run VACUUM FULL
  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details',
    sched,
    $cmd$SET statement_timeout='0'; VACUUM (FULL, VERBOSE, ANALYZE) public.garmin_activity_details;$cmd$
  );

  -- Schedule cleanup of the job definitions after 30 minutes
  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details-cleanup',
    cleanup_sched,
    $cmd$SELECT cron.unschedule('oneoff-vacuum-garmin-details'); SELECT cron.unschedule('oneoff-vacuum-garmin-details-cleanup');$cmd$
  );
END $do$;