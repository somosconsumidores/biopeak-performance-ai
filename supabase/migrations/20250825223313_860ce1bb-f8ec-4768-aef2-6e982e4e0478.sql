-- Create function to calculate VO2max using Daniels' formula
CREATE OR REPLACE FUNCTION public.calculate_vo2_max_daniels(
  distance_meters double precision,
  time_minutes double precision
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  velocity_ms double precision;
  vo2_result numeric;
BEGIN
  -- Validate inputs
  IF distance_meters IS NULL OR distance_meters <= 0 OR 
     time_minutes IS NULL OR time_minutes <= 0 THEN
    RETURN NULL;
  END IF;
  
  -- Calculate velocity in m/s
  velocity_ms := distance_meters / (time_minutes * 60.0);
  
  -- Daniels' formula: VO2max = -4.6 + 0.182258 * (velocity in m/min) + 0.000104 * (velocity in m/min)^2
  -- Convert velocity from m/s to m/min
  vo2_result := -4.6 + 0.182258 * (velocity_ms * 60.0) + 0.000104 * POWER(velocity_ms * 60.0, 2);
  
  -- Return rounded to 1 decimal place, ensure positive result
  RETURN CASE WHEN vo2_result > 0 THEN ROUND(vo2_result, 1) ELSE NULL END;
END;
$function$;

-- Create view for activities with calculated Daniels VO2max
CREATE OR REPLACE VIEW public.v_all_activities_with_vo2_daniels AS
SELECT 
  *,
  CASE 
    WHEN activity_type ILIKE '%run%' 
      AND total_distance_meters IS NOT NULL 
      AND total_time_minutes IS NOT NULL
      AND total_distance_meters >= 800  -- Minimum 800m for meaningful calculation
      AND total_time_minutes > 0
    THEN public.calculate_vo2_max_daniels(total_distance_meters, total_time_minutes)
    ELSE NULL
  END AS vo2_max_daniels
FROM public.all_activities
WHERE activity_type ILIKE '%run%'
  AND total_distance_meters IS NOT NULL 
  AND total_time_minutes IS NOT NULL
  AND total_distance_meters >= 800
  AND total_time_minutes > 0
ORDER BY activity_date DESC;