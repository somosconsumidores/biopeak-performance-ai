-- Create garmin_tokens table to store user tokens permanently
CREATE TABLE public.garmin_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_secret TEXT,
  consumer_key TEXT,
  oauth_verifier TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create oauth_temp_tokens table for temporary PKCE data
CREATE TABLE public.oauth_temp_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'garmin',
  oauth_token TEXT NOT NULL,
  oauth_token_secret TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.garmin_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_temp_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for garmin_tokens
CREATE POLICY "Users can view their own garmin tokens" 
ON public.garmin_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own garmin tokens" 
ON public.garmin_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own garmin tokens" 
ON public.garmin_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own garmin tokens" 
ON public.garmin_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for oauth_temp_tokens
CREATE POLICY "Users can view their own temp tokens" 
ON public.oauth_temp_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own temp tokens" 
ON public.oauth_temp_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own temp tokens" 
ON public.oauth_temp_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own temp tokens" 
ON public.oauth_temp_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates on garmin_tokens
CREATE TRIGGER update_garmin_tokens_updated_at
BEFORE UPDATE ON public.garmin_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();