
-- Create table for sync control and rate limiting
CREATE TABLE IF NOT EXISTS garmin_sync_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  sync_type TEXT NOT NULL, -- 'activities', 'details', 'dailies'
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  triggered_by TEXT NOT NULL, -- 'webhook', 'manual'
  webhook_payload JSONB,
  callback_url TEXT,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE garmin_sync_control ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own sync control" 
  ON garmin_sync_control 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage sync control" 
  ON garmin_sync_control 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_garmin_sync_control_user_id ON garmin_sync_control(user_id);
CREATE INDEX IF NOT EXISTS idx_garmin_sync_control_type_time ON garmin_sync_control(user_id, sync_type, last_sync_at);

-- Function to check if sync is allowed (rate limiting)
CREATE OR REPLACE FUNCTION can_sync_user(
  user_id_param UUID,
  sync_type_param TEXT,
  min_interval_minutes INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_sync TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the last sync time for this user and sync type
  SELECT last_sync_at INTO last_sync
  FROM garmin_sync_control
  WHERE user_id = user_id_param 
    AND sync_type = sync_type_param
    AND status = 'completed'
  ORDER BY last_sync_at DESC
  LIMIT 1;
  
  -- If no previous sync, allow it
  IF last_sync IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if enough time has passed
  RETURN (NOW() - last_sync) > (min_interval_minutes * INTERVAL '1 minute');
END;
$$;

-- Function to log sync attempt
CREATE OR REPLACE FUNCTION log_sync_attempt(
  user_id_param UUID,
  sync_type_param TEXT,
  triggered_by_param TEXT,
  webhook_payload_param JSONB DEFAULT NULL,
  callback_url_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sync_id UUID;
BEGIN
  INSERT INTO garmin_sync_control (
    user_id,
    sync_type,
    triggered_by,
    webhook_payload,
    callback_url,
    status
  ) VALUES (
    user_id_param,
    sync_type_param,
    triggered_by_param,
    webhook_payload_param,
    callback_url_param,
    'pending'
  ) RETURNING id INTO sync_id;
  
  RETURN sync_id;
END;
$$;

-- Function to update sync status
CREATE OR REPLACE FUNCTION update_sync_status(
  sync_id_param UUID,
  status_param TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE garmin_sync_control
  SET status = status_param,
      updated_at = NOW(),
      last_sync_at = CASE WHEN status_param = 'completed' THEN NOW() ELSE last_sync_at END
  WHERE id = sync_id_param;
END;
$$;
