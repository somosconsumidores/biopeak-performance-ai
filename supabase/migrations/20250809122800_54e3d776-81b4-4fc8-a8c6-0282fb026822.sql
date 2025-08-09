-- Create polar_activity_details table similar to garmin_activity_details
CREATE TABLE public.polar_activity_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  polar_user_id BIGINT,
  sample_timestamp BIGINT,
  heart_rate INTEGER,
  speed_meters_per_second DOUBLE PRECISION,
  latitude_in_degree DOUBLE PRECISION,
  longitude_in_degree DOUBLE PRECISION,
  elevation_in_meters DOUBLE PRECISION,
  total_distance_in_meters DOUBLE PRECISION,
  duration_in_seconds INTEGER,
  power_in_watts INTEGER,
  cadence INTEGER,
  temperature_celsius DOUBLE PRECISION,
  samples JSONB,
  activity_summary JSONB,
  device_name TEXT,
  activity_type TEXT,
  activity_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.polar_activity_details ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own polar activity details" 
ON public.polar_activity_details 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own polar activity details" 
ON public.polar_activity_details 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own polar activity details" 
ON public.polar_activity_details 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own polar activity details" 
ON public.polar_activity_details 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_polar_activity_details_user_id ON public.polar_activity_details(user_id);
CREATE INDEX idx_polar_activity_details_activity_id ON public.polar_activity_details(activity_id);
CREATE INDEX idx_polar_activity_details_sample_timestamp ON public.polar_activity_details(sample_timestamp);
CREATE INDEX idx_polar_activity_details_total_distance ON public.polar_activity_details(total_distance_in_meters);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_polar_activity_details_updated_at
BEFORE UPDATE ON public.polar_activity_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();