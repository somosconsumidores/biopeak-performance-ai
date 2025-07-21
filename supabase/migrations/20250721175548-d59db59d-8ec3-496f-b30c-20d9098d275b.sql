
-- Add is_active column to garmin_tokens to track connection status
ALTER TABLE garmin_tokens 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create table for webhook logging and auditoria
CREATE TABLE IF NOT EXISTS garmin_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  webhook_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'success',
  error_message TEXT,
  garmin_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on webhook logs
ALTER TABLE garmin_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhook logs
CREATE POLICY "Users can view their own webhook logs" 
  ON garmin_webhook_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage webhook logs" 
  ON garmin_webhook_logs 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_garmin_webhook_logs_user_id ON garmin_webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_garmin_webhook_logs_webhook_type ON garmin_webhook_logs(webhook_type);
CREATE INDEX IF NOT EXISTS idx_garmin_webhook_logs_garmin_user_id ON garmin_webhook_logs(garmin_user_id);

-- Function to deactivate user tokens and clean up data
CREATE OR REPLACE FUNCTION deactivate_garmin_user(garmin_user_id_param TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deactivate tokens for the Garmin user ID
  UPDATE garmin_tokens 
  SET is_active = false, 
      updated_at = NOW()
  WHERE token_secret LIKE '%' || garmin_user_id_param || '%' 
     OR consumer_key = garmin_user_id_param;
  
  -- Log the deactivation
  RAISE NOTICE 'Deactivated Garmin tokens for user: %', garmin_user_id_param;
END;
$$;
