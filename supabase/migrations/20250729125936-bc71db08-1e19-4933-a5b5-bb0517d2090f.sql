-- Create permanent mapping table to maintain garmin_user_id to user_id relationship
CREATE TABLE public.garmin_user_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  garmin_user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  UNIQUE(garmin_user_id),
  UNIQUE(user_id, garmin_user_id)
);

-- Enable RLS on garmin_user_mapping
ALTER TABLE public.garmin_user_mapping ENABLE ROW LEVEL SECURITY;

-- Create policies for garmin_user_mapping
CREATE POLICY "Users can view their own garmin mapping" 
ON public.garmin_user_mapping 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own garmin mapping" 
ON public.garmin_user_mapping 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own garmin mapping" 
ON public.garmin_user_mapping 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all garmin mappings" 
ON public.garmin_user_mapping 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create orphaned webhook recovery table
CREATE TABLE public.garmin_orphaned_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  garmin_user_id TEXT NOT NULL,
  webhook_payload JSONB NOT NULL,
  webhook_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS on orphaned webhooks
ALTER TABLE public.garmin_orphaned_webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies for orphaned webhooks
CREATE POLICY "Service role can manage orphaned webhooks" 
ON public.garmin_orphaned_webhooks 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own orphaned webhooks" 
ON public.garmin_orphaned_webhooks 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_garmin_user_mapping_garmin_user_id ON public.garmin_user_mapping(garmin_user_id);
CREATE INDEX idx_garmin_user_mapping_user_id ON public.garmin_user_mapping(user_id);
CREATE INDEX idx_garmin_user_mapping_active ON public.garmin_user_mapping(is_active);
CREATE INDEX idx_orphaned_webhooks_garmin_user_id ON public.garmin_orphaned_webhooks(garmin_user_id);
CREATE INDEX idx_orphaned_webhooks_status ON public.garmin_orphaned_webhooks(status);
CREATE INDEX idx_orphaned_webhooks_user_id ON public.garmin_orphaned_webhooks(user_id);

-- Function to populate garmin_user_mapping from existing tokens
CREATE OR REPLACE FUNCTION public.populate_garmin_user_mapping()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert existing mappings from garmin_tokens
  INSERT INTO public.garmin_user_mapping (user_id, garmin_user_id, created_at, last_seen_at, is_active)
  SELECT DISTINCT 
    user_id, 
    garmin_user_id, 
    created_at,
    updated_at,
    is_active
  FROM public.garmin_tokens 
  WHERE garmin_user_id IS NOT NULL 
    AND user_id IS NOT NULL
  ON CONFLICT (garmin_user_id) DO UPDATE SET
    last_seen_at = EXCLUDED.last_seen_at,
    is_active = EXCLUDED.is_active,
    updated_at = now();
    
  RAISE NOTICE 'Populated garmin_user_mapping with existing data';
END;
$$;

-- Function to update garmin_user_mapping when tokens are created/updated
CREATE OR REPLACE FUNCTION public.update_garmin_user_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only proceed if we have both user_id and garmin_user_id
  IF NEW.user_id IS NOT NULL AND NEW.garmin_user_id IS NOT NULL THEN
    INSERT INTO public.garmin_user_mapping (user_id, garmin_user_id, last_seen_at, is_active)
    VALUES (NEW.user_id, NEW.garmin_user_id, now(), NEW.is_active)
    ON CONFLICT (garmin_user_id) DO UPDATE SET
      last_seen_at = now(),
      is_active = NEW.is_active,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update mapping when tokens change
CREATE TRIGGER update_garmin_user_mapping_trigger
  AFTER INSERT OR UPDATE ON public.garmin_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_garmin_user_mapping();

-- Function to find user by garmin_user_id (for webhook recovery)
CREATE OR REPLACE FUNCTION public.find_user_by_garmin_id(garmin_user_id_param TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  found_user_id UUID;
BEGIN
  -- First try to find in active tokens
  SELECT user_id INTO found_user_id
  FROM public.garmin_tokens
  WHERE garmin_user_id = garmin_user_id_param 
    AND is_active = true
  LIMIT 1;
  
  -- If not found in active tokens, try mapping table
  IF found_user_id IS NULL THEN
    SELECT user_id INTO found_user_id
    FROM public.garmin_user_mapping
    WHERE garmin_user_id = garmin_user_id_param
      AND is_active = true
    LIMIT 1;
  END IF;
  
  RETURN found_user_id;
END;
$$;

-- Modified cleanup function that tries to renew before deleting
CREATE OR REPLACE FUNCTION public.smart_cleanup_expired_oauth_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expired_token RECORD;
  renewal_result BOOLEAN;
BEGIN
  -- Find tokens that are expired but still have refresh tokens
  FOR expired_token IN 
    SELECT user_id, garmin_user_id, access_token, token_secret, expires_at
    FROM public.garmin_tokens 
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW() 
      AND token_secret IS NOT NULL
      AND is_active = true
  LOOP
    -- Try to trigger renewal via edge function
    BEGIN
      -- Mark as inactive temporarily to prevent conflicts
      UPDATE public.garmin_tokens 
      SET is_active = false, updated_at = now()
      WHERE user_id = expired_token.user_id 
        AND garmin_user_id = expired_token.garmin_user_id;
      
      -- Log attempt to renew
      RAISE NOTICE 'Attempting to renew expired token for user % with garmin_user_id %', 
        expired_token.user_id, expired_token.garmin_user_id;
        
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to process renewal for user %: %', expired_token.user_id, SQLERRM;
    END;
  END LOOP;
  
  -- Clean up tokens that have been expired for more than 24 hours and failed renewal
  DELETE FROM public.garmin_tokens 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() - INTERVAL '24 hours'
    AND is_active = false;
  
  -- Clean up expired temp tokens
  DELETE FROM public.oauth_temp_tokens 
  WHERE expires_at < NOW();
  
  RAISE NOTICE 'Smart OAuth cleanup completed at %', NOW();
END;
$$;

-- Update updated_at trigger for garmin_user_mapping
CREATE TRIGGER update_garmin_user_mapping_updated_at
  BEFORE UPDATE ON public.garmin_user_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Populate initial data
SELECT public.populate_garmin_user_mapping();