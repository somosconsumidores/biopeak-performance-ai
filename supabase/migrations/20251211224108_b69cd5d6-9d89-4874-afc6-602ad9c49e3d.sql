-- Create RPC function to get admin dashboard stats with proper counts
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'garmin_tokens', (SELECT COUNT(DISTINCT user_id) FROM garmin_tokens WHERE is_active = TRUE),
    'strava_tokens', (SELECT COUNT(DISTINCT user_id) FROM strava_tokens WHERE access_token IS NOT NULL),
    'polar_tokens', (SELECT COUNT(DISTINCT user_id) FROM polar_tokens WHERE is_active = TRUE),
    'users_with_activities', (SELECT COUNT(DISTINCT user_id) FROM all_activities),
    'active_subscribers', (SELECT COUNT(*) FROM subscribers WHERE subscribed = TRUE),
    'users_with_phone', (SELECT COUNT(*) FROM profiles WHERE phone IS NOT NULL AND phone != ''),
    'active_plans', (SELECT COUNT(DISTINCT user_id) FROM training_plans WHERE status = 'active'),
    'avg_age_all', (SELECT ROUND(AVG(EXTRACT(YEAR FROM AGE(NOW(), birth_date)))::numeric, 1) FROM profiles WHERE birth_date IS NOT NULL),
    'avg_age_subscribers', (SELECT ROUND(AVG(EXTRACT(YEAR FROM AGE(NOW(), p.birth_date)))::numeric, 1) FROM subscribers s JOIN profiles p ON s.user_id = p.user_id WHERE s.subscribed = TRUE AND p.birth_date IS NOT NULL),
    'activity_sources', (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT activity_source as source, COUNT(*) as count FROM all_activities GROUP BY activity_source ORDER BY count DESC) t),
    'goal_distribution', (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT goal as name, COUNT(*) as value FROM user_onboarding WHERE goal IS NOT NULL GROUP BY goal ORDER BY value DESC) t),
    'athletic_level_distribution', (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT athletic_level as name, COUNT(*) as value FROM user_onboarding WHERE athletic_level IS NOT NULL GROUP BY athletic_level ORDER BY value DESC) t)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;