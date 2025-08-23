-- Schedule VACUUM FULL to run in ~1 minute without statement timeout via pg_cron
select cron.schedule_in(
  '1 minute',
  $$
  SET statement_timeout='0';
  VACUUM (FULL, VERBOSE, ANALYZE) public.garmin_activity_details;
  $$
) as job_id;