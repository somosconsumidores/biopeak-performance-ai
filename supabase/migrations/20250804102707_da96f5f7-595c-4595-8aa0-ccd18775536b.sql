-- Add last_login_at column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN last_login_at timestamp with time zone;

-- Create user_access_logs table for detailed access history
CREATE TABLE public.user_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  login_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_access_logs
ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_access_logs
CREATE POLICY "Users can view their own access logs"
ON public.user_access_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert access logs"
ON public.user_access_logs
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Create index for better performance
CREATE INDEX idx_user_access_logs_user_id_login_at ON public.user_access_logs(user_id, login_at DESC);

-- Create function to update last_login_at in profiles
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login_at = NEW.login_at,
      updated_at = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update last_login_at
CREATE TRIGGER update_profiles_last_login
AFTER INSERT ON public.user_access_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_last_login();