-- Create table for Garmin daily summaries
CREATE TABLE public.garmin_daily_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  summary_id TEXT NOT NULL,
  calendar_date DATE NOT NULL,
  start_time_in_seconds BIGINT,
  start_time_offset_in_seconds INTEGER,
  activity_type TEXT,
  duration_in_seconds INTEGER,
  steps INTEGER,
  pushes INTEGER,
  distance_in_meters NUMERIC,
  push_distance_in_meters NUMERIC,
  active_time_in_seconds INTEGER,
  active_kilocalories INTEGER,
  bmr_kilocalories INTEGER,
  moderate_intensity_duration_in_seconds INTEGER,
  vigorous_intensity_duration_in_seconds INTEGER,
  floors_climbed INTEGER,
  min_heart_rate_in_beats_per_minute INTEGER,
  average_heart_rate_in_beats_per_minute INTEGER,
  max_heart_rate_in_beats_per_minute INTEGER,
  resting_heart_rate_in_beats_per_minute INTEGER,
  time_offset_heart_rate_samples JSONB,
  average_stress_level INTEGER,
  max_stress_level INTEGER,
  stress_duration_in_seconds INTEGER,
  rest_stress_duration_in_seconds INTEGER,
  activity_stress_duration_in_seconds INTEGER,
  low_stress_duration_in_seconds INTEGER,
  medium_stress_duration_in_seconds INTEGER,
  high_stress_duration_in_seconds INTEGER,
  stress_qualifier TEXT,
  steps_goal INTEGER,
  pushes_goal INTEGER,
  intensity_duration_goal_in_seconds INTEGER,
  floors_climbed_goal INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, summary_id)
);

-- Enable RLS
ALTER TABLE public.garmin_daily_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own daily summaries" 
ON public.garmin_daily_summaries 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily summaries" 
ON public.garmin_daily_summaries 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily summaries" 
ON public.garmin_daily_summaries 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily summaries" 
ON public.garmin_daily_summaries 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_garmin_daily_summaries_updated_at
BEFORE UPDATE ON public.garmin_daily_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_garmin_daily_summaries_user_id ON public.garmin_daily_summaries(user_id);
CREATE INDEX idx_garmin_daily_summaries_calendar_date ON public.garmin_daily_summaries(calendar_date);
CREATE INDEX idx_garmin_daily_summaries_summary_id ON public.garmin_daily_summaries(summary_id);