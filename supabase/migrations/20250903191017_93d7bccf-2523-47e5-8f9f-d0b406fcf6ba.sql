-- Optimize user lookup during GAS backfill
CREATE INDEX IF NOT EXISTS idx_all_activities_user_date_incl
ON public.all_activities (user_id, activity_date)
INCLUDE (total_time_minutes, average_heart_rate, max_heart_rate);
