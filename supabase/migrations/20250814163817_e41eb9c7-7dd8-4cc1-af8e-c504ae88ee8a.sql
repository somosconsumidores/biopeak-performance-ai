CREATE OR REPLACE FUNCTION public.get_unique_strava_activities_with_details()
RETURNS TABLE(user_id uuid, strava_activity_id bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT DISTINCT 
    sad.user_id,
    sad.strava_activity_id
  FROM public.strava_activity_details sad
  ORDER BY sad.user_id, sad.strava_activity_id;
$function$