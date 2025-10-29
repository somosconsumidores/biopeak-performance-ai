-- Create subscription_updates table for real-time notifications
CREATE TABLE IF NOT EXISTS subscription_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('subscription_updated', 'subscription_deleted', 'payment_failed', 'subscription_activated')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast user lookups
CREATE INDEX idx_subscription_updates_user_timestamp 
ON subscription_updates(user_id, timestamp DESC);

-- Enable RLS
ALTER TABLE subscription_updates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own updates
CREATE POLICY "Users can view own subscription updates"
ON subscription_updates FOR SELECT
USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE subscription_updates;

-- Auto-cleanup function (delete records older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_subscription_updates()
RETURNS void AS $$
BEGIN
  DELETE FROM subscription_updates 
  WHERE timestamp < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (manual trigger or cron)
COMMENT ON FUNCTION cleanup_old_subscription_updates IS 'Cleanup subscription_updates older than 1 hour. Run periodically via pg_cron or edge function.';