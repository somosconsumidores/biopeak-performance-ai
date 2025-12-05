-- Create materialized view for active subscribers
CREATE MATERIALIZED VIEW mv_active_subscribers AS
SELECT 
  s.user_id,
  s.email,
  p.phone,
  p.display_name,
  s.created_at AS creation_date
FROM subscribers s
LEFT JOIN profiles p ON s.user_id = p.user_id
WHERE s.subscribed = TRUE;

-- Create index for faster lookups
CREATE INDEX idx_mv_active_subscribers_user_id ON mv_active_subscribers(user_id);

-- Grant access to service role
GRANT SELECT ON mv_active_subscribers TO service_role;