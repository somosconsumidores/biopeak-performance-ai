
-- Delete all records for user 4906fdd6-e163-4539-9b3a-5c6f62e2a4ef from all tables
-- Order matters due to potential dependencies

-- Delete from garmin_activity_details first
DELETE FROM garmin_activity_details WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from garmin_activities
DELETE FROM garmin_activities WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from garmin_daily_summaries
DELETE FROM garmin_daily_summaries WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from performance_metrics
DELETE FROM performance_metrics WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from user_commitments
DELETE FROM user_commitments WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from garmin_sync_control
DELETE FROM garmin_sync_control WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from garmin_backfill_requests
DELETE FROM garmin_backfill_requests WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from garmin_webhook_logs
DELETE FROM garmin_webhook_logs WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from garmin_user_permissions
DELETE FROM garmin_user_permissions WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from garmin_tokens
DELETE FROM garmin_tokens WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Delete from oauth_temp_tokens
DELETE FROM oauth_temp_tokens WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';

-- Finally, delete from profiles (but keep the user in auth.users as that's managed by Supabase)
DELETE FROM profiles WHERE user_id = '4906fdd6-e163-4539-9b3a-5c6f62e2a4ef';
