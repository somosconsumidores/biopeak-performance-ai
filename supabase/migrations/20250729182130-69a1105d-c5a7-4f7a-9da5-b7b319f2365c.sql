-- Disable the problematic cron jobs temporarily
SELECT cron.unschedule('proactive-token-renewal');
SELECT cron.unschedule('garmin-token-health-monitor');

-- Clear any remaining invalid tokens from the specific user  
DELETE FROM garmin_tokens 
WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';

-- Clear any temp tokens that might be causing loops
DELETE FROM oauth_temp_tokens 
WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b' 
   OR oauth_token LIKE '%fdbb553c-f18c-4e68-a641-16911a8580ef%';

-- Clear orphaned webhooks for this user
DELETE FROM garmin_orphaned_webhooks 
WHERE user_id = '6659197c-19c0-4156-87af-52d0a0a3a58b';