-- FASE 2 & 3: Create tables for rate limiting and token blacklisting

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.garmin_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_rate_limit UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.garmin_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for rate limits
CREATE POLICY "Users can view their own rate limits" 
ON public.garmin_rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage rate limits" 
ON public.garmin_rate_limits 
FOR ALL 
USING (true);

-- Token blacklist table
CREATE TABLE IF NOT EXISTS public.garmin_blocked_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT NOT NULL,
  user_id UUID,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_token_hash UNIQUE(token_hash)
);

-- Enable RLS
ALTER TABLE public.garmin_blocked_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for blocked tokens
CREATE POLICY "System can manage blocked tokens" 
ON public.garmin_blocked_tokens 
FOR ALL 
USING (true);

-- FASE 4: Create monitoring table for tracking function calls
CREATE TABLE IF NOT EXISTS public.garmin_function_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  function_name TEXT NOT NULL,
  request_type TEXT,
  user_agent TEXT,
  referer TEXT,
  ip_address TEXT,
  success BOOLEAN,
  error_message TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.garmin_function_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for function calls
CREATE POLICY "System can manage function calls" 
ON public.garmin_function_calls 
FOR ALL 
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_garmin_rate_limits_user_id ON public.garmin_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_garmin_rate_limits_last_attempt ON public.garmin_rate_limits(last_attempt);
CREATE INDEX IF NOT EXISTS idx_garmin_blocked_tokens_hash ON public.garmin_blocked_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_garmin_function_calls_user_id ON public.garmin_function_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_garmin_function_calls_created_at ON public.garmin_function_calls(created_at);

-- Auto-cleanup old rate limit data (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM public.garmin_rate_limits 
  WHERE last_attempt < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup old function call logs (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_function_calls() RETURNS void AS $$
BEGIN
  DELETE FROM public.garmin_function_calls 
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;