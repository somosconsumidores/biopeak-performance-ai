-- Fix database function search paths to prevent SQL injection vulnerabilities
-- This addresses the critical security issue where functions don't have secure search paths

-- 1. Fix calculate_activity_date function
CREATE OR REPLACE FUNCTION public.calculate_activity_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Convert Unix timestamp to date considering local timezone offset
  IF NEW.start_time_in_seconds IS NOT NULL THEN
    IF NEW.start_time_offset_in_seconds IS NOT NULL THEN
      NEW.activity_date = DATE(to_timestamp(NEW.start_time_in_seconds) + INTERVAL '1 second' * NEW.start_time_offset_in_seconds);
    ELSE
      NEW.activity_date = DATE(to_timestamp(NEW.start_time_in_seconds));
    END IF;
  ELSE
    NEW.activity_date = NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Fix calculate_vo2_max function
CREATE OR REPLACE FUNCTION public.calculate_vo2_max(activity_type_param text, pace_min_km double precision, avg_hr integer, max_hr integer)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  calibration_factor CONSTANT DECIMAL := 16;
  speed_m_per_min DECIMAL;
  vo2_theoretical DECIMAL;
  effort_ratio DECIMAL;
  vo2_result DECIMAL;
BEGIN
  -- Only calculate for running activities
  IF activity_type_param IS NULL OR LOWER(activity_type_param) NOT LIKE '%run%' THEN
    RETURN NULL;
  END IF;
  
  -- Validate input parameters
  IF pace_min_km IS NULL OR pace_min_km <= 0 OR 
     avg_hr IS NULL OR avg_hr <= 0 OR 
     max_hr IS NULL OR max_hr <= 0 THEN
    RETURN NULL;
  END IF;
  
  -- Calculate VO2max using the provided formula
  speed_m_per_min := 1000 / pace_min_km::DECIMAL;
  vo2_theoretical := 3.5 * speed_m_per_min;
  effort_ratio := avg_hr::DECIMAL / max_hr::DECIMAL;
  
  vo2_result := vo2_theoretical / effort_ratio / calibration_factor;
  
  -- Return rounded to 1 decimal place
  RETURN ROUND(vo2_result, 1);
END;
$function$;

-- 3. Fix auto_calculate_vo2_max function
CREATE OR REPLACE FUNCTION public.auto_calculate_vo2_max()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Calculate VO2max when inserting or updating running activities
  NEW.vo2_max := public.calculate_vo2_max(
    NEW.activity_type,
    NEW.average_pace_in_minutes_per_kilometer,
    NEW.average_heart_rate_in_beats_per_minute,
    NEW.max_heart_rate_in_beats_per_minute
  );
  
  RETURN NEW;
END;
$function$;

-- 4. Fix sync_all_users_dailies function
CREATE OR REPLACE FUNCTION public.sync_all_users_dailies()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  user_record RECORD;
BEGIN
  -- Loop through all users who have Garmin tokens
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM public.garmin_tokens 
    WHERE access_token IS NOT NULL
  LOOP
    -- Call the edge function for each user
    PERFORM extensions.net.http_post(
      url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/sync-garmin-dailies',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT access_token FROM public.garmin_tokens WHERE user_id = user_record.user_id LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  END LOOP;
  
  RAISE NOTICE 'Daily sync completed for all users at %', NOW();
END;
$function$;

-- 5. Fix cleanup_expired_oauth_data function
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Clean up expired garmin tokens
  DELETE FROM public.garmin_tokens 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  -- Clean up expired temp tokens (they should expire in 10 minutes)
  DELETE FROM public.oauth_temp_tokens 
  WHERE expires_at < NOW();
  
  -- Log cleanup activity
  RAISE NOTICE 'OAuth cleanup completed at %', NOW();
END;
$function$;

-- 6. Fix auto_cleanup_expired_oauth function
CREATE OR REPLACE FUNCTION public.auto_cleanup_expired_oauth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Perform cleanup when new tokens are inserted
  PERFORM public.cleanup_expired_oauth_data();
  RETURN NEW;
END;
$function$;

-- 7. Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 8. Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (new.id, new.raw_user_meta_data ->> 'display_name', new.email);
  RETURN new;
END;
$function$;