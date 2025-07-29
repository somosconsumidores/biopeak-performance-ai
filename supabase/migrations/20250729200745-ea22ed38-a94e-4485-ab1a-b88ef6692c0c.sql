-- Complete cleanup of problematic user data
-- User ID: 6659197c-19c0-4156-87af-52d0a0a3a58b
-- Garmin User ID: 4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6

DO $$
BEGIN
  -- Delete from garmin_activities
  DELETE FROM garmin_activities WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
  
  -- Delete from garmin_activity_details
  DELETE FROM garmin_activity_details WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
  
  -- Delete from garmin_backfill_requests
  DELETE FROM garmin_backfill_requests WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b' OR garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
  
  -- Delete from garmin_webhook_logs
  DELETE FROM garmin_webhook_logs WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b' OR garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
  
  -- Delete from garmin_orphaned_webhooks
  DELETE FROM garmin_orphaned_webhooks WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b' OR garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
  
  -- Delete from garmin_user_mapping
  DELETE FROM garmin_user_mapping WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b' OR garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
  
  -- Delete from garmin_sync_control
  DELETE FROM garmin_sync_control WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
  
  -- Delete from garmin_rate_limits
  DELETE FROM garmin_rate_limits WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
  
  -- Delete from garmin_function_calls
  DELETE FROM garmin_function_calls WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
  
  -- Delete from garmin_user_permissions
  DELETE FROM garmin_user_permissions WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b' OR garmin_user_id = '4d3b12c3-a220-4023-8d0c-2ad06bf4d3a6';
  
  -- Delete from performance_metrics
  DELETE FROM performance_metrics WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
  
  -- Delete from garmin_daily_summaries
  DELETE FROM garmin_daily_summaries WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
  
  -- Delete from profiles
  DELETE FROM profiles WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';
  
END $$;