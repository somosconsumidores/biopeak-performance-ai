-- Fix the cleanup function to give time for automatic token refresh
-- Instead of deleting immediately expired tokens, only delete tokens that have been expired for more than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Clean up garmin tokens that have been expired for more than 1 hour
  -- This gives time for automatic token refresh to work
  DELETE FROM public.garmin_tokens 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() - INTERVAL '1 hour';
  
  -- Clean up expired temp tokens (they should expire in 10 minutes)
  DELETE FROM public.oauth_temp_tokens 
  WHERE expires_at < NOW();
  
  -- Log cleanup activity
  RAISE NOTICE 'OAuth cleanup completed at %', NOW();
END;
$function$;