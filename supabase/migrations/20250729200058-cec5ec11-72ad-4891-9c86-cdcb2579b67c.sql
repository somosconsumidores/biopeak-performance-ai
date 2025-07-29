-- Complete cleanup of problematic user data
-- User ID: 6659197c-19c0-4156-87af-52d0a0a3a58b
-- Garmin User ID: 4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6

BEGIN;

-- Log the cleanup operation
RAISE NOTICE 'Starting complete cleanup for user: 6659197c-19c0-4156-87af-52d0a0a3a58b';

-- Delete from tables by user_id
DELETE FROM garmin_activities WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_activities records', ROW_COUNT;

DELETE FROM garmin_activity_details WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_activity_details records', ROW_COUNT;

DELETE FROM garmin_backfill_requests WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_backfill_requests records', ROW_COUNT;

DELETE FROM garmin_blocked_tokens WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_blocked_tokens records', ROW_COUNT;

DELETE FROM garmin_daily_summaries WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_daily_summaries records', ROW_COUNT;

DELETE FROM garmin_function_calls WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_function_calls records', ROW_COUNT;

DELETE FROM garmin_orphaned_webhooks WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_orphaned_webhooks records', ROW_COUNT;

DELETE FROM garmin_rate_limits WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_rate_limits records', ROW_COUNT;

DELETE FROM garmin_sync_control WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_sync_control records', ROW_COUNT;

DELETE FROM garmin_tokens WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_tokens records', ROW_COUNT;

DELETE FROM garmin_user_mapping WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_user_mapping records', ROW_COUNT;

DELETE FROM garmin_user_permissions WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_user_permissions records', ROW_COUNT;

DELETE FROM garmin_webhook_logs WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % garmin_webhook_logs records', ROW_COUNT;

DELETE FROM oauth_states WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % oauth_states records', ROW_COUNT;

DELETE FROM oauth_temp_tokens WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % oauth_temp_tokens records', ROW_COUNT;

DELETE FROM performance_metrics WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % performance_metrics records', ROW_COUNT;

DELETE FROM profiles WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % profiles records', ROW_COUNT;

DELETE FROM user_commitments WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % user_commitments records', ROW_COUNT;

DELETE FROM polar_activities WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % polar_activities records', ROW_COUNT;

DELETE FROM polar_sync_control WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % polar_sync_control records', ROW_COUNT;

DELETE FROM polar_tokens WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % polar_tokens records', ROW_COUNT;

DELETE FROM polar_webhook_logs WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % polar_webhook_logs records', ROW_COUNT;

DELETE FROM strava_activities WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % strava_activities records', ROW_COUNT;

DELETE FROM strava_activity_streams WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % strava_activity_streams records', ROW_COUNT;

DELETE FROM strava_sync_status WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % strava_sync_status records', ROW_COUNT;

DELETE FROM strava_tokens WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
RAISE NOTICE 'Deleted % strava_tokens records', ROW_COUNT;

-- Delete by garmin_user_id where applicable
DELETE FROM garmin_backfill_requests WHERE garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
RAISE NOTICE 'Deleted % additional garmin_backfill_requests by garmin_user_id', ROW_COUNT;

DELETE FROM garmin_orphaned_webhooks WHERE garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
RAISE NOTICE 'Deleted % additional garmin_orphaned_webhooks by garmin_user_id', ROW_COUNT;

DELETE FROM garmin_tokens WHERE garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
RAISE NOTICE 'Deleted % additional garmin_tokens by garmin_user_id', ROW_COUNT;

DELETE FROM garmin_user_mapping WHERE garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
RAISE NOTICE 'Deleted % additional garmin_user_mapping by garmin_user_id', ROW_COUNT;

DELETE FROM garmin_user_permissions WHERE garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
RAISE NOTICE 'Deleted % additional garmin_user_permissions by garmin_user_id', ROW_COUNT;

DELETE FROM garmin_webhook_logs WHERE garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
RAISE NOTICE 'Deleted % additional garmin_webhook_logs by garmin_user_id', ROW_COUNT;

RAISE NOTICE 'Complete cleanup finished for user: 6659197c-19c0-4156-87af-52d0a0a3a58b';

COMMIT;