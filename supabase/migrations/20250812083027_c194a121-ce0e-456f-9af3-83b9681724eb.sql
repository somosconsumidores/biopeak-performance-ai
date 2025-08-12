-- Create function to return provider-related user stats
CREATE OR REPLACE FUNCTION public.get_provider_user_stats()
RETURNS TABLE(
  users_with_polar_tokens integer,
  users_with_polar_activities integer,
  users_with_strava_tokens integer,
  users_with_strava_activities integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT 
    /* Count distinct users with active Polar tokens */
    COALESCE((
      SELECT COUNT(DISTINCT pt.user_id)::integer
      FROM public.polar_tokens pt
      WHERE pt.is_active = true
    ), 0) AS users_with_polar_tokens,

    /* Count distinct users with at least 1 Polar activity */
    COALESCE((
      SELECT COUNT(DISTINCT pa.user_id)::integer
      FROM public.polar_activities pa
    ), 0) AS users_with_polar_activities,

    /* Count distinct users with Strava tokens (access_token present) */
    COALESCE((
      SELECT COUNT(DISTINCT st.user_id)::integer
      FROM public.strava_tokens st
      WHERE st.access_token IS NOT NULL
    ), 0) AS users_with_strava_tokens,

    /* Count distinct users with at least 1 Strava activity */
    COALESCE((
      SELECT COUNT(DISTINCT sa.user_id)::integer
      FROM public.strava_activities sa
    ), 0) AS users_with_strava_activities;
$$;