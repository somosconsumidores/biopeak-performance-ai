-- Delete all data for user: 5d9b7cf5-de1c-48f1-b482-b93a38612238

-- Delete from dependent tables first (those that might reference other tables)
DELETE FROM garmin_activity_details WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM garmin_backfill_requests WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM garmin_sync_control WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM garmin_user_permissions WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM garmin_webhook_logs WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM performance_metrics WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM polar_webhook_logs WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM strava_activity_streams WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

-- Delete from main activity tables
DELETE FROM garmin_activities WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM garmin_daily_summaries WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM polar_activities WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM polar_sync_control WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM strava_activities WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM strava_sync_status WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

-- Delete from token tables
DELETE FROM garmin_tokens WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM polar_tokens WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM strava_tokens WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

-- Delete from oauth tables
DELETE FROM oauth_states WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM oauth_temp_tokens WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

-- Delete from user tables
DELETE FROM user_commitments WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';

DELETE FROM profiles WHERE user_id = '5d9b7cf5-de1c-48f1-b482-b93a38612238';