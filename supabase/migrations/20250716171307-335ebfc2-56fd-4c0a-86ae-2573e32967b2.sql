-- Add automatic cleanup of expired OAuth tokens and temp tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create a trigger function to clean up on new insertions
CREATE OR REPLACE FUNCTION public.auto_cleanup_expired_oauth()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Perform cleanup when new tokens are inserted
  PERFORM public.cleanup_expired_oauth_data();
  RETURN NEW;
END;
$$;

-- Create trigger that runs cleanup when new tokens are inserted
DROP TRIGGER IF EXISTS auto_cleanup_trigger ON public.garmin_tokens;
CREATE TRIGGER auto_cleanup_trigger
  AFTER INSERT ON public.garmin_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cleanup_expired_oauth();

-- Create a simple unique index on user_id to prevent duplicate tokens
DROP INDEX IF EXISTS idx_garmin_tokens_user_unique;
CREATE UNIQUE INDEX idx_garmin_tokens_user_unique ON public.garmin_tokens(user_id);

-- Run initial cleanup
SELECT public.cleanup_expired_oauth_data();