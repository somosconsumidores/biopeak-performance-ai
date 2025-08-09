-- Create function to get polar activities without details
CREATE OR REPLACE FUNCTION public.get_polar_activities_without_details()
RETURNS TABLE (
  activity_id text,
  user_id uuid,
  polar_user_id bigint,
  activity_type text,
  start_time timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT 
    pa.activity_id,
    pa.user_id,
    pa.polar_user_id,
    pa.activity_type,
    pa.start_time
  FROM public.polar_activities pa
  LEFT JOIN public.polar_activity_details pad 
    ON pa.activity_id = pad.activity_id AND pa.user_id = pad.user_id
  WHERE pad.activity_id IS NULL;
$$;