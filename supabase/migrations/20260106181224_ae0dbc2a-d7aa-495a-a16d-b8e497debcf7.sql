-- RPC to get distinct active subscribers with activities in date range
CREATE OR REPLACE FUNCTION public.active_users_with_activities(p_start date, p_end date)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT a.user_id
  FROM public.all_activities a
  JOIN public.subscribers s ON s.user_id = a.user_id
  WHERE s.subscribed = true
    AND a.activity_date >= p_start
    AND a.activity_date <= p_end
    AND a.user_id IS NOT NULL;
END;
$$;

-- RPC to get distinct activity dates for a specific user
CREATE OR REPLACE FUNCTION public.user_activity_dates(p_user uuid, p_start date, p_end date)
RETURNS TABLE(activity_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT a.activity_date::date
  FROM public.all_activities a
  WHERE a.user_id = p_user
    AND a.activity_date >= p_start
    AND a.activity_date <= p_end
    AND a.activity_date IS NOT NULL
  ORDER BY a.activity_date;
END;
$$;

-- Restrict access to service_role only
REVOKE ALL ON FUNCTION public.active_users_with_activities(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.active_users_with_activities(date, date) TO service_role;

REVOKE ALL ON FUNCTION public.user_activity_dates(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_activity_dates(uuid, date, date) TO service_role;