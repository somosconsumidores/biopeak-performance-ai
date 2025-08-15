-- Create secure RPC for top login users by email
CREATE OR REPLACE FUNCTION public.get_top_login_users(limit_count integer DEFAULT 10)
RETURNS TABLE(email text, user_id uuid, login_days integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only admins can call this
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT p.email, ual.user_id, COUNT(DISTINCT date_trunc('day', ual.login_at))::integer AS login_days
  FROM public.user_access_logs ual
  JOIN public.profiles p ON p.user_id = ual.user_id
  GROUP BY p.email, ual.user_id
  ORDER BY login_days DESC
  LIMIT limit_count;
END;
$$;