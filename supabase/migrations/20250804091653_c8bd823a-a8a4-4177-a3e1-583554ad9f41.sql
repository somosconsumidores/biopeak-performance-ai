-- Create garmin_sleep_summaries table
CREATE TABLE public.garmin_sleep_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  summary_id TEXT NOT NULL,
  calendar_date DATE NOT NULL,
  sleep_time_in_seconds INTEGER,
  sleep_quality_type_name TEXT,
  deep_sleep_duration_in_seconds INTEGER,
  light_sleep_duration_in_seconds INTEGER,
  rem_sleep_duration_in_seconds INTEGER,
  awake_duration_in_seconds INTEGER,
  sleep_start_time_in_seconds BIGINT,
  sleep_end_time_in_seconds BIGINT,
  sleep_start_time_offset_in_seconds INTEGER,
  sleep_end_time_offset_in_seconds INTEGER,
  unmeasurable_sleep_in_seconds INTEGER,
  awakening_count INTEGER,
  avg_sleep_stress NUMERIC,
  age_group TEXT,
  sleep_score INTEGER,
  sleep_score_feedback TEXT,
  sleep_score_insight TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, summary_id)
);

-- Enable Row Level Security
ALTER TABLE public.garmin_sleep_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own sleep summaries" 
ON public.garmin_sleep_summaries 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sleep summaries" 
ON public.garmin_sleep_summaries 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sleep summaries" 
ON public.garmin_sleep_summaries 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sleep summaries" 
ON public.garmin_sleep_summaries 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_garmin_sleep_summaries_updated_at
BEFORE UPDATE ON public.garmin_sleep_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();