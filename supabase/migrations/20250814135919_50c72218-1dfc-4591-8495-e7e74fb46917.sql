-- Create statistics_metrics table for advanced activity analysis
CREATE TABLE public.statistics_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  source_activity TEXT NOT NULL, -- 'Garmin', 'Strava', 'Strava GPX', 'Zepp GPX', 'Polar', 'Zepp'
  total_distance_km NUMERIC,
  total_time_minutes NUMERIC,
  average_pace_min_km NUMERIC,
  average_heart_rate NUMERIC,
  max_heart_rate NUMERIC,
  heart_rate_std_dev NUMERIC,
  pace_std_dev NUMERIC,
  heart_rate_cv_percent NUMERIC, -- coefficient of variation for HR
  pace_cv_percent NUMERIC, -- coefficient of variation for pace
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of user + activity + source
  UNIQUE(user_id, activity_id, source_activity)
);

-- Enable Row Level Security
ALTER TABLE public.statistics_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own statistics metrics" 
ON public.statistics_metrics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own statistics metrics" 
ON public.statistics_metrics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own statistics metrics" 
ON public.statistics_metrics 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own statistics metrics" 
ON public.statistics_metrics 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all statistics metrics" 
ON public.statistics_metrics 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Create indexes for performance
CREATE INDEX idx_statistics_metrics_user_id ON public.statistics_metrics(user_id);
CREATE INDEX idx_statistics_metrics_activity_id ON public.statistics_metrics(activity_id);
CREATE INDEX idx_statistics_metrics_source ON public.statistics_metrics(source_activity);
CREATE INDEX idx_statistics_metrics_created_at ON public.statistics_metrics(created_at);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_statistics_metrics_updated_at
BEFORE UPDATE ON public.statistics_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();