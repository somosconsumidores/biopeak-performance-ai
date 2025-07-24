-- Delete all records for users b4cfb6e7-4893-4951-8524-4dc4bce3a2cd and 2eaae66f-c929-47c6-ad94-7d288ce5c572

-- Delete from garmin_activities
DELETE FROM public.garmin_activities 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from garmin_activity_details
DELETE FROM public.garmin_activity_details 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from garmin_backfill_requests
DELETE FROM public.garmin_backfill_requests 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from garmin_daily_summaries
DELETE FROM public.garmin_daily_summaries 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from garmin_sync_control
DELETE FROM public.garmin_sync_control 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from garmin_tokens
DELETE FROM public.garmin_tokens 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from garmin_user_permissions
DELETE FROM public.garmin_user_permissions 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from garmin_webhook_logs
DELETE FROM public.garmin_webhook_logs 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from oauth_temp_tokens
DELETE FROM public.oauth_temp_tokens 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from performance_metrics
DELETE FROM public.performance_metrics 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from profiles
DELETE FROM public.profiles 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');

-- Delete from user_commitments
DELETE FROM public.user_commitments 
WHERE user_id IN ('b4cfb6e7-4893-4951-8524-4dc4bce3a2cd', '2eaae66f-c929-47c6-ad94-7d288ce5c572');