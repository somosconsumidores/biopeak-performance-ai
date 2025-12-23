-- Create materialized view for active subscribers' activities in the last 30 days
CREATE MATERIALIZED VIEW mv_all_activities_30_days AS
SELECT 
  a.id,
  a.user_id,
  a.activity_id,
  a.activity_source,
  a.activity_type,
  a.activity_date,
  a.total_distance_meters,
  a.total_time_minutes,
  a.pace_min_per_km,
  a.average_heart_rate,
  a.max_heart_rate,
  a.active_kilocalories,
  a.total_elevation_gain_in_meters,
  a.total_elevation_loss_in_meters,
  a.device_name,
  a.detected_workout_type,
  a.created_at,
  a.updated_at
FROM all_activities a
INNER JOIN subscribers s ON a.user_id = s.user_id
WHERE s.subscribed = TRUE
  AND a.activity_date >= CURRENT_DATE - INTERVAL '30 days';

-- Create indexes for common query patterns
CREATE INDEX idx_mv_all_activities_30_days_user_id ON mv_all_activities_30_days(user_id);
CREATE INDEX idx_mv_all_activities_30_days_activity_date ON mv_all_activities_30_days(activity_date);
CREATE INDEX idx_mv_all_activities_30_days_activity_source ON mv_all_activities_30_days(activity_source);