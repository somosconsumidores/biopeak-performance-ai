-- Delete all data for specific users from all tables
-- User IDs to delete: 11c23f7e-e7a2-4d73-be1a-066aca0045ba, 2fd084f6-b630-4a78-bb75-60fc67b83635, c87ff11f-3cef-4873-856d-43ba00454c81

-- Delete from dependent tables first (those that might reference other tables)
DELETE FROM garmin_activity_details WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM garmin_backfill_requests WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM garmin_sync_control WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM garmin_user_permissions WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM garmin_webhook_logs WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM performance_metrics WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM polar_webhook_logs WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM strava_activity_streams WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

-- Delete from main activity tables
DELETE FROM garmin_activities WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM garmin_daily_summaries WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM polar_activities WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM polar_sync_control WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM strava_activities WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM strava_sync_status WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

-- Delete from token tables
DELETE FROM garmin_tokens WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM polar_tokens WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM strava_tokens WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

-- Delete from oauth tables
DELETE FROM oauth_states WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM oauth_temp_tokens WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

-- Delete from user tables
DELETE FROM user_commitments WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');

DELETE FROM profiles WHERE user_id IN ('11c23f7e-e7a2-4d73-be1a-066aca0045ba', '2fd084f6-b630-4a78-bb75-60fc67b83635', 'c87ff11f-3cef-4873-856d-43ba00454c81');