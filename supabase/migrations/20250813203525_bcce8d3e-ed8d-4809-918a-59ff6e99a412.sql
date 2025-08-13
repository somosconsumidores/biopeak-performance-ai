-- Create Zepp GPX activities table
CREATE TABLE public.zepp_gpx_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL UNIQUE,
  name TEXT,
  activity_type TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  distance_in_meters NUMERIC,
  duration_in_seconds INTEGER,
  calories INTEGER,
  elevation_gain_meters NUMERIC,
  elevation_loss_meters NUMERIC,
  average_speed_ms NUMERIC,
  max_speed_ms NUMERIC,
  average_heart_rate INTEGER,
  max_heart_rate INTEGER,
  average_pace_min_km NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Zepp GPX activity details table
CREATE TABLE public.zepp_gpx_activity_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  sample_timestamp BIGINT,
  heart_rate INTEGER,
  speed_meters_per_second DOUBLE PRECISION,
  latitude_in_degree DOUBLE PRECISION,
  longitude_in_degree DOUBLE PRECISION,
  elevation_in_meters DOUBLE PRECISION,
  total_distance_in_meters DOUBLE PRECISION,
  duration_in_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zepp_gpx_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zepp_gpx_activity_details ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for zepp_gpx_activities
CREATE POLICY "Users can view their own zepp gpx activities" 
ON public.zepp_gpx_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own zepp gpx activities" 
ON public.zepp_gpx_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zepp gpx activities" 
ON public.zepp_gpx_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zepp gpx activities" 
ON public.zepp_gpx_activities 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all zepp gpx activities" 
ON public.zepp_gpx_activities 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create RLS policies for zepp_gpx_activity_details
CREATE POLICY "Users can view their own zepp gpx activity details" 
ON public.zepp_gpx_activity_details 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own zepp gpx activity details" 
ON public.zepp_gpx_activity_details 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zepp gpx activity details" 
ON public.zepp_gpx_activity_details 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zepp gpx activity details" 
ON public.zepp_gpx_activity_details 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all zepp gpx activity details" 
ON public.zepp_gpx_activity_details 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_zepp_gpx_activities_user_id ON public.zepp_gpx_activities(user_id);
CREATE INDEX idx_zepp_gpx_activities_start_time ON public.zepp_gpx_activities(start_time);
CREATE INDEX idx_zepp_gpx_activity_details_user_id ON public.zepp_gpx_activity_details(user_id);
CREATE INDEX idx_zepp_gpx_activity_details_activity_id ON public.zepp_gpx_activity_details(activity_id);

-- Add triggers for updated_at
CREATE TRIGGER update_zepp_gpx_activities_updated_at
BEFORE UPDATE ON public.zepp_gpx_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zepp_gpx_activity_details_updated_at
BEFORE UPDATE ON public.zepp_gpx_activity_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();