-- Fix the stuck Strava sync status for the specific user
UPDATE strava_sync_status 
SET 
  sync_status = 'completed',
  last_sync_at = '2025-01-05 19:29:27+00',
  total_activities_synced = 138,
  updated_at = NOW()
WHERE user_id = 'fa155754-46c5-4f12-99e2-54a9673ff74f';

-- Create function to automatically recover stuck Strava syncs
CREATE OR REPLACE FUNCTION public.recover_stuck_strava_syncs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Update stuck 'in_progress' syncs that are older than 1 hour
  UPDATE strava_sync_status 
  SET 
    sync_status = 'error',
    error_message = 'Sync timeout - marked as failed after 1 hour',
    updated_at = NOW()
  WHERE sync_status = 'in_progress' 
    AND updated_at < NOW() - INTERVAL '1 hour';
  
  RAISE NOTICE 'Recovered stuck Strava syncs at %', NOW();
END;
$function$;