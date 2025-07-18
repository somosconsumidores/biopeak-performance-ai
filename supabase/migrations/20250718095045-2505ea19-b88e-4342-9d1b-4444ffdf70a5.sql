-- Enable pg_cron and pg_net extensions for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to sync dailies for all users
CREATE OR REPLACE FUNCTION sync_all_users_dailies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Loop through all users who have Garmin tokens
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM garmin_tokens 
    WHERE access_token IS NOT NULL
  LOOP
    -- Call the edge function for each user
    PERFORM net.http_post(
      url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/sync-garmin-dailies',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT access_token FROM garmin_tokens WHERE user_id = user_record.user_id LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  END LOOP;
  
  RAISE NOTICE 'Daily sync completed for all users at %', NOW();
END;
$$;

-- Schedule the function to run every day at 6 AM UTC
SELECT cron.schedule(
  'sync-garmin-dailies',
  '0 6 * * *', -- Every day at 6 AM UTC
  $$SELECT sync_all_users_dailies();$$
);