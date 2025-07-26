-- Delete all records for user 84226820-8e94-4020-9c0e-02e53a2962ec from all tables

-- Delete from garmin_activities
DELETE FROM public.garmin_activities 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from garmin_activity_details
DELETE FROM public.garmin_activity_details 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from garmin_backfill_requests
DELETE FROM public.garmin_backfill_requests 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from garmin_daily_summaries
DELETE FROM public.garmin_daily_summaries 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from garmin_sync_control
DELETE FROM public.garmin_sync_control 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from garmin_tokens
DELETE FROM public.garmin_tokens 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from garmin_user_permissions
DELETE FROM public.garmin_user_permissions 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from garmin_webhook_logs
DELETE FROM public.garmin_webhook_logs 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from oauth_temp_tokens
DELETE FROM public.oauth_temp_tokens 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from performance_metrics
DELETE FROM public.performance_metrics 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from profiles
DELETE FROM public.profiles 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';

-- Delete from user_commitments
DELETE FROM public.user_commitments 
WHERE user_id = '84226820-8e94-4020-9c0e-02e53a2962ec';