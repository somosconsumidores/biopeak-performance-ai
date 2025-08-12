-- Unique logins by date for admin chart
CREATE OR REPLACE FUNCTION public.get_unique_logins_by_date()
RETURNS TABLE(date date, users integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH raw AS (
    SELECT date_trunc('day', login_at)::date AS day,
           COUNT(DISTINCT user_id) AS users
    FROM public.user_access_logs
    GROUP BY 1
  ), bounds AS (
    SELECT 
      (SELECT MIN(date_trunc('day', login_at))::date FROM public.user_access_logs) AS start_date,
      CURRENT_DATE AS end_date
  ), series AS (
    SELECT generate_series(start_date, end_date, interval '1 day')::date AS day
    FROM bounds
  )
  SELECT s.day AS date, COALESCE(r.users, 0)::integer AS users
  FROM series s
  LEFT JOIN raw r ON r.day = s.day
  ORDER BY s.day;
$$;