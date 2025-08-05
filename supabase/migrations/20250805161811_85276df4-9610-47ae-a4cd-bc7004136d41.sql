-- Fix the stuck sync status for user 11c23f7e-e7a2-4d73-be1a-066aca0045ba
UPDATE strava_sync_status 
SET 
  sync_status = 'completed',
  last_sync_at = '2025-08-05 15:01:00+00'::timestamp with time zone,
  total_activities_synced = 154,
  updated_at = now()
WHERE user_id = '11c23f7e-e7a2-4d73-be1a-066aca0045ba'::uuid 
  AND sync_status = 'in_progress';