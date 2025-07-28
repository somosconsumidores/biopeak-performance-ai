-- Create polar_tokens table similar to garmin_tokens
CREATE TABLE public.polar_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'bearer',
  expires_in BIGINT,
  expires_at TIMESTAMP WITH TIME ZONE,
  x_user_id BIGINT,
  polar_user_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for polar_tokens
ALTER TABLE public.polar_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for polar_tokens
CREATE POLICY "Users can view their own polar tokens" 
ON public.polar_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own polar tokens" 
ON public.polar_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own polar tokens" 
ON public.polar_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own polar tokens" 
ON public.polar_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at column
CREATE TRIGGER update_polar_tokens_updated_at
BEFORE UPDATE ON public.polar_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create polar_activities table
CREATE TABLE public.polar_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL UNIQUE,
  polar_user_id BIGINT,
  upload_time TIMESTAMP WITH TIME ZONE,
  polar_user TEXT,
  transaction_id BIGINT,
  device TEXT,
  device_id TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  start_time_utc_offset INTEGER,
  duration TEXT,
  distance NUMERIC,
  activity_type TEXT,
  calories INTEGER,
  training_load NUMERIC,
  sport TEXT,
  has_route BOOLEAN DEFAULT false,
  club_id BIGINT,
  club_name TEXT,
  detailed_sport_info TEXT,
  fat_percentage_of_calories NUMERIC,
  carbohydrate_percentage_of_calories NUMERIC,
  protein_percentage_of_calories NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for polar_activities
ALTER TABLE public.polar_activities ENABLE ROW LEVEL SECURITY;

-- Create policies for polar_activities
CREATE POLICY "Users can view their own polar activities" 
ON public.polar_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own polar activities" 
ON public.polar_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own polar activities" 
ON public.polar_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own polar activities" 
ON public.polar_activities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at column
CREATE TRIGGER update_polar_activities_updated_at
BEFORE UPDATE ON public.polar_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Extend oauth_temp_tokens to support multiple providers
ALTER TABLE public.oauth_temp_tokens 
ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'garmin';

-- Create polar_sync_control table
CREATE TABLE public.polar_sync_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  triggered_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for polar_sync_control
ALTER TABLE public.polar_sync_control ENABLE ROW LEVEL SECURITY;

-- Create policies for polar_sync_control
CREATE POLICY "Service role can manage polar sync control" 
ON public.polar_sync_control 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own polar sync control" 
ON public.polar_sync_control 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at column
CREATE TRIGGER update_polar_sync_control_updated_at
BEFORE UPDATE ON public.polar_sync_control
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();