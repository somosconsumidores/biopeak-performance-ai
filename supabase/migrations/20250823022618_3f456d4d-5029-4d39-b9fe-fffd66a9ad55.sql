-- Schedule a one-off VACUUM FULL in ~1 minute via pg_cron (using cron.schedule)
DO $$
DECLARE
  ts timestamptz := now() + interval '1 minute';
  sched text := to_char(ts, 'MI HH24 DD MM') || ' *';
  cleanup_ts timestamptz := ts + interval '30 minutes';
  cleanup_sched text := to_char(cleanup_ts, 'MI HH24 DD MM') || ' *';
BEGIN
  -- Try to unschedule any previous jobs with the same names (ignore errors if not existing)
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('oneoff-vacuum-garmin-details-cleanup'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Schedule the VACUUM FULL to run once at the computed minute
  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details',
    sched,
    $$VACUUM (FULL, VERBOSE, ANALYZE) public.garmin_activity_details;$$
  );

  -- Schedule a cleanup job to remove the one-off job after 30 minutes
  PERFORM cron.schedule(
    'oneoff-vacuum-garmin-details-cleanup',
    cleanup_sched,
    $$SELECT cron.unschedule('oneoff-vacuum-garmin-details');$$
  );
END $$;