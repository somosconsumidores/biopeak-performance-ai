-- Create table to store temporary OAuth states
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  state_value TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own OAuth states" 
ON public.oauth_states 
FOR ALL 
USING (auth.uid() = user_id);

-- Create index for cleanup
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- Create function to cleanup expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.oauth_states WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;