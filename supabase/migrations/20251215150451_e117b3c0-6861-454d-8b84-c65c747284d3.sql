-- Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_active_subscribers;

-- Recreate with utm_source field
CREATE MATERIALIZED VIEW mv_active_subscribers AS
SELECT 
  s.user_id,
  p.email,
  p.phone,
  p.display_name,
  p.utm_source,
  s.created_at as creation_date
FROM subscribers s
JOIN profiles p ON s.user_id = p.id
WHERE s.subscribed = TRUE;

-- Recreate index
CREATE INDEX idx_mv_active_subscribers_user_id ON mv_active_subscribers(user_id);