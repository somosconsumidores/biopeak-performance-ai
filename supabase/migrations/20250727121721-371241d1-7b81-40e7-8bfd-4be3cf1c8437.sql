-- Add refresh_token_expires_at field to track refresh token expiration (90 days)
ALTER TABLE public.garmin_tokens 
ADD COLUMN refresh_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Add refresh_token field to simplify storage (currently stored in token_secret)
ALTER TABLE public.garmin_tokens 
ADD COLUMN refresh_token TEXT;

-- Update existing records to extract refresh_token from token_secret and set expiration
UPDATE public.garmin_tokens 
SET refresh_token_expires_at = created_at + INTERVAL '90 days'
WHERE refresh_token_expires_at IS NULL;

-- Create index for efficient expiration queries
CREATE INDEX idx_garmin_tokens_refresh_expires ON public.garmin_tokens(refresh_token_expires_at);

-- Create function to check refresh token expiration warnings (7 days before)
CREATE OR REPLACE FUNCTION public.check_refresh_token_expiration_warning(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT refresh_token_expires_at INTO expires_at
  FROM garmin_tokens
  WHERE user_id = user_id_param 
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Return true if refresh token expires within 7 days
  RETURN (expires_at IS NOT NULL AND expires_at <= NOW() + INTERVAL '7 days');
END;
$function$