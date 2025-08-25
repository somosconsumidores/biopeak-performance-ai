-- Harden calculate_vo2_max_daniels: make it immutable and security invoker (no DB access)
CREATE OR REPLACE FUNCTION public.calculate_vo2_max_daniels(
  distance_meters double precision,
  time_minutes double precision
) RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  velocity_ms double precision;
  vo2_result numeric;
BEGIN
  IF distance_meters IS NULL OR distance_meters <= 0 OR 
     time_minutes IS NULL OR time_minutes <= 0 THEN
    RETURN NULL;
  END IF;

  velocity_ms := distance_meters / (time_minutes * 60.0);
  vo2_result := -4.6 + 0.182258 * (velocity_ms * 60.0) + 0.000104 * POWER(velocity_ms * 60.0, 2);
  RETURN CASE WHEN vo2_result > 0 THEN ROUND(vo2_result, 1) ELSE NULL END;
END;
$function$;