-- Create aggregated admin stats for tokens and activities across providers
CREATE OR REPLACE FUNCTION public.get_admin_user_stats()
RETURNS TABLE(
  total_users integer,
  users_with_valid_token integer,
  users_with_activities integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH total_users_cte AS (
    SELECT COUNT(*)::integer AS total_users FROM public.profiles
  ),
  valid_token_users AS (
    SELECT DISTINCT gt.user_id
    FROM public.garmin_tokens gt
    WHERE gt.is_active = true
      AND gt.access_token IS NOT NULL
      AND (gt.refresh_token_expires_at IS NULL OR gt.refresh_token_expires_at > NOW())
    UNION
    SELECT DISTINCT st.user_id
    FROM public.strava_tokens st
    WHERE st.access_token IS NOT NULL
      AND (st.expires_at IS NULL OR st.expires_at > NOW())
    UNION
    SELECT DISTINCT pt.user_id
    FROM public.polar_tokens pt
    WHERE pt.is_active = true
    UNION
    SELECT DISTINCT zt.user_id
    FROM public.zepp_tokens zt
    WHERE zt.is_active = true
  ),
  activity_users AS (
    SELECT DISTINCT user_id
    FROM public.all_activities
    WHERE activity_source IN ('garmin','strava','polar','strava_gpx','zepp_gpx','zepp')
  )
  SELECT
    (SELECT total_users FROM total_users_cte) AS total_users,
    (SELECT COUNT(*)::integer FROM valid_token_users) AS users_with_valid_token,
    (SELECT COUNT(*)::integer FROM activity_users) AS users_with_activities;
$$;