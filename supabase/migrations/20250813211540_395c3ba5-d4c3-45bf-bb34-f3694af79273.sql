-- Update the check constraint to include zepp_gpx as a valid activity source
ALTER TABLE activity_chart_cache DROP CONSTRAINT IF EXISTS activity_chart_cache_source_chk;

ALTER TABLE activity_chart_cache ADD CONSTRAINT activity_chart_cache_source_chk 
CHECK (activity_source IN ('garmin', 'polar', 'strava', 'gpx', 'zepp_gpx'));