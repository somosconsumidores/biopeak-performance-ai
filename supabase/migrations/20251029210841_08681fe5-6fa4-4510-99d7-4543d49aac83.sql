-- Fix search_path for cleanup function to resolve security warning
DROP FUNCTION IF EXISTS cleanup_old_strava_sync_jobs();

CREATE OR REPLACE FUNCTION cleanup_old_strava_sync_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM strava_sync_jobs
  WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';