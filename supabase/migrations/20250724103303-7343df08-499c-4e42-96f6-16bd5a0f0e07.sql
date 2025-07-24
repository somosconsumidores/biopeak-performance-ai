-- Delete all records for user 9a2c2220-5833-4b73-a839-cc127ca45631

-- Delete from garmin_activities
DELETE FROM public.garmin_activities 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from garmin_activity_details
DELETE FROM public.garmin_activity_details 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from garmin_backfill_requests
DELETE FROM public.garmin_backfill_requests 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from garmin_daily_summaries
DELETE FROM public.garmin_daily_summaries 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from garmin_sync_control
DELETE FROM public.garmin_sync_control 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from garmin_tokens
DELETE FROM public.garmin_tokens 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from garmin_user_permissions
DELETE FROM public.garmin_user_permissions 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from garmin_webhook_logs
DELETE FROM public.garmin_webhook_logs 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from oauth_temp_tokens
DELETE FROM public.oauth_temp_tokens 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from performance_metrics
DELETE FROM public.performance_metrics 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from profiles
DELETE FROM public.profiles 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';

-- Delete from user_commitments
DELETE FROM public.user_commitments 
WHERE user_id = '9a2c2220-5833-4b73-a839-cc127ca45631';