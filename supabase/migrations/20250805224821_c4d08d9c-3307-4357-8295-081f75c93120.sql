-- Add new columns to performance_metrics table for Strava-specific metrics
ALTER TABLE public.performance_metrics 
ADD COLUMN movement_efficiency NUMERIC,
ADD COLUMN pace_consistency NUMERIC,
ADD COLUMN pace_distribution_beginning NUMERIC,
ADD COLUMN pace_distribution_middle NUMERIC, 
ADD COLUMN pace_distribution_end NUMERIC,
ADD COLUMN terrain_adaptation_score NUMERIC,
ADD COLUMN fatigue_index NUMERIC,
ADD COLUMN activity_source TEXT DEFAULT 'garmin';

-- Add comments for documentation
COMMENT ON COLUMN public.performance_metrics.movement_efficiency IS 'Distance covered per minute of activity';
COMMENT ON COLUMN public.performance_metrics.pace_consistency IS 'Coefficient of variation for pace consistency';
COMMENT ON COLUMN public.performance_metrics.pace_distribution_beginning IS 'Average pace in first third of activity';
COMMENT ON COLUMN public.performance_metrics.pace_distribution_middle IS 'Average pace in middle third of activity';
COMMENT ON COLUMN public.performance_metrics.pace_distribution_end IS 'Average pace in final third of activity';
COMMENT ON COLUMN public.performance_metrics.terrain_adaptation_score IS 'Score for terrain adaptation based on elevation changes';
COMMENT ON COLUMN public.performance_metrics.fatigue_index IS 'Index indicating pace degradation over time';
COMMENT ON COLUMN public.performance_metrics.activity_source IS 'Source of the activity data (garmin, strava, polar)';