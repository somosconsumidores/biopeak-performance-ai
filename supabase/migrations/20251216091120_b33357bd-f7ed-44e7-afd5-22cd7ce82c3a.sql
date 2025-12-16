
-- Create function to get unique logins by date for subscribers only
CREATE OR REPLACE FUNCTION get_unique_logins_by_date_subscribers()
RETURNS TABLE (
  login_date date,
  users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '59 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS login_date
  ),
  daily_logins AS (
    SELECT 
      DATE(ual.created_at) AS login_date,
      COUNT(DISTINCT ual.user_id) AS users
    FROM user_access_logs ual
    INNER JOIN subscribers s ON s.user_id = ual.user_id AND s.subscribed = TRUE
    WHERE ual.created_at >= CURRENT_DATE - INTERVAL '59 days'
    GROUP BY DATE(ual.created_at)
  )
  SELECT 
    ds.login_date,
    COALESCE(dl.users, 0) AS users
  FROM date_series ds
  LEFT JOIN daily_logins dl ON ds.login_date = dl.login_date
  ORDER BY ds.login_date;
END;
$$;
