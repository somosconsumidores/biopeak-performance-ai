-- Add indexes to optimize subscription checks on subscribers table

-- Index on user_id for fast lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id 
ON subscribers(user_id);

-- Composite index for active subscription checks
CREATE INDEX IF NOT EXISTS idx_subscribers_active 
ON subscribers(user_id, subscribed, subscription_end) 
WHERE subscribed = true;

-- Comment explaining the optimization
COMMENT ON INDEX idx_subscribers_active IS 
'Optimizes queries checking for active, non-expired subscriptions';
