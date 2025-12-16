-- Drop and recreate the function with correct return type
DROP FUNCTION IF EXISTS get_unique_logins_by_date();

CREATE OR REPLACE FUNCTION get_unique_logins_by_date()
RETURNS TABLE(date date, users bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH raw AS (
    SELECT date_trunc('day', login_at)::date AS day,
           COUNT(DISTINCT user_id) AS users
    FROM public.user_access_logs
    WHERE login_at >= (now() - interval '60 days')
    GROUP BY 1
  ), bounds AS (
    SELECT 
      (now() - interval '60 days')::date AS start_date,
      CURRENT_DATE AS end_date
  ), series AS (
    SELECT generate_series(start_date, end_date, interval '1 day')::date AS day
    FROM bounds
  )
  SELECT s.day AS date, COALESCE(r.users, 0) AS users
  FROM series s
  LEFT JOIN raw r ON r.day = s.day
  ORDER BY s.day;
$$;