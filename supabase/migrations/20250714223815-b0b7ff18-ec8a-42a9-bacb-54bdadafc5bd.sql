-- Create garmin_activities table to store all activity data from Garmin API
CREATE TABLE public.garmin_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  summary_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  activity_type TEXT,
  start_time_in_seconds BIGINT,
  start_time_offset_in_seconds INTEGER,
  duration_in_seconds INTEGER,
  distance_in_meters FLOAT,
  active_kilocalories INTEGER,
  device_name TEXT,
  
  -- Heart rate fields
  average_heart_rate_in_beats_per_minute INTEGER,
  max_heart_rate_in_beats_per_minute INTEGER,
  
  -- Speed and pace fields
  average_speed_in_meters_per_second FLOAT,
  max_speed_in_meters_per_second FLOAT,
  average_pace_in_minutes_per_kilometer FLOAT,
  max_pace_in_minutes_per_kilometer FLOAT,
  
  -- Cadence fields
  average_bike_cadence_in_rounds_per_minute FLOAT,
  max_bike_cadence_in_rounds_per_minute FLOAT,
  average_run_cadence_in_steps_per_minute FLOAT,
  max_run_cadence_in_steps_per_minute FLOAT,
  average_push_cadence_in_pushes_per_minute FLOAT,
  max_push_cadence_in_pushes_per_minute FLOAT,
  average_swim_cadence_in_strokes_per_minute FLOAT,
  
  -- Location and elevation fields
  starting_latitude_in_degree FLOAT,
  starting_longitude_in_degree FLOAT,
  total_elevation_gain_in_meters FLOAT,
  total_elevation_loss_in_meters FLOAT,
  
  -- Additional fields
  steps INTEGER,
  pushes INTEGER,
  number_of_active_lengths INTEGER,
  is_parent BOOLEAN,
  parent_summary_id TEXT,
  manual BOOLEAN,
  is_web_upload BOOLEAN,
  
  -- Metadata
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id, summary_id)
);

-- Enable Row Level Security
ALTER TABLE public.garmin_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own activities" 
ON public.garmin_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities" 
ON public.garmin_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities" 
ON public.garmin_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities" 
ON public.garmin_activities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_garmin_activities_updated_at
BEFORE UPDATE ON public.garmin_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_garmin_activities_user_id ON public.garmin_activities(user_id);
CREATE INDEX idx_garmin_activities_summary_id ON public.garmin_activities(summary_id);
CREATE INDEX idx_garmin_activities_activity_type ON public.garmin_activities(activity_type);
CREATE INDEX idx_garmin_activities_start_time ON public.garmin_activities(start_time_in_seconds);