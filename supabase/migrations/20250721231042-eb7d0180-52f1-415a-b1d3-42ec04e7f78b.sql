
-- Create table to store Garmin user permissions
CREATE TABLE public.garmin_user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  garmin_user_id TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, garmin_user_id)
);

-- Enable Row Level Security
ALTER TABLE public.garmin_user_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own permissions" 
  ON public.garmin_user_permissions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own permissions" 
  ON public.garmin_user_permissions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own permissions" 
  ON public.garmin_user_permissions 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all permissions" 
  ON public.garmin_user_permissions 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_garmin_user_permissions_updated_at
  BEFORE UPDATE ON public.garmin_user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
