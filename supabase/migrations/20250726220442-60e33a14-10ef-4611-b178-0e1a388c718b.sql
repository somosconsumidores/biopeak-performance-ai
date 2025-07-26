-- Delete all records for user 7ccb4b25-9129-4661-8f2e-49624a3e939e from all tables

-- Delete from garmin_activities
DELETE FROM public.garmin_activities 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from garmin_activity_details
DELETE FROM public.garmin_activity_details 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from garmin_backfill_requests
DELETE FROM public.garmin_backfill_requests 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from garmin_daily_summaries
DELETE FROM public.garmin_daily_summaries 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from garmin_sync_control
DELETE FROM public.garmin_sync_control 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from garmin_tokens
DELETE FROM public.garmin_tokens 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from garmin_user_permissions
DELETE FROM public.garmin_user_permissions 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from garmin_webhook_logs
DELETE FROM public.garmin_webhook_logs 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from oauth_temp_tokens
DELETE FROM public.oauth_temp_tokens 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from performance_metrics
DELETE FROM public.performance_metrics 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from profiles
DELETE FROM public.profiles 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';

-- Delete from user_commitments
DELETE FROM public.user_commitments 
WHERE user_id = '7ccb4b25-9129-4661-8f2e-49624a3e939e';