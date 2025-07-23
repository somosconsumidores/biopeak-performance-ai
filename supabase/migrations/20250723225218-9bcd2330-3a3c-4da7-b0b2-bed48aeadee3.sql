-- Delete all records for user acf4b589-7b7b-4782-af02-64836fafb14d

-- Delete from performance_metrics first (no dependencies)
DELETE FROM performance_metrics WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from garmin_activity_details
DELETE FROM garmin_activity_details WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from garmin_activities
DELETE FROM garmin_activities WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from garmin_daily_summaries
DELETE FROM garmin_daily_summaries WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from user_commitments
DELETE FROM user_commitments WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from garmin_backfill_requests
DELETE FROM garmin_backfill_requests WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from garmin_webhook_logs
DELETE FROM garmin_webhook_logs WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from garmin_sync_control
DELETE FROM garmin_sync_control WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from garmin_user_permissions
DELETE FROM garmin_user_permissions WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from oauth_temp_tokens
DELETE FROM oauth_temp_tokens WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from garmin_tokens
DELETE FROM garmin_tokens WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';

-- Delete from profiles (last, as it's the main user record)
DELETE FROM profiles WHERE user_id = 'acf4b589-7b7b-4782-af02-64836fafb14d';