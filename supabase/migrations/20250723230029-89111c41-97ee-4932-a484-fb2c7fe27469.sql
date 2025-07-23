-- Set up a trigger to automatically sync activities when user connects
-- For now, let's just trigger a manual sync for the specific user

-- First, let's manually insert a sync control record to trigger the sync
INSERT INTO garmin_sync_control (
  user_id,
  sync_type,
  triggered_by,
  status,
  webhook_payload,
  created_at,
  last_sync_at
) VALUES (
  '69d46588-92a4-4a38-9abc-4071348d7c6a',
  'activities',
  'manual_trigger',
  'pending',
  '{"manualSync": true, "userNeedsSync": true}',
  NOW(),
  NOW()
);