-- Create performance_metrics table for pre-calculated metrics
CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  
  -- Efficiency metrics
  power_per_beat DECIMAL,
  distance_per_minute DECIMAL,
  efficiency_comment TEXT,
  
  -- Pace metrics
  average_speed_kmh DECIMAL,
  pace_variation_coefficient DECIMAL,
  pace_comment TEXT,
  
  -- Heart Rate metrics
  average_hr INTEGER,
  relative_intensity DECIMAL,
  relative_reserve DECIMAL,
  heart_rate_comment TEXT,
  
  -- Effort Distribution metrics
  effort_beginning_bpm INTEGER,
  effort_middle_bpm INTEGER,
  effort_end_bpm INTEGER,
  effort_distribution_comment TEXT,
  
  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(user_id, activity_id)
);

-- Enable Row Level Security
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own performance metrics" 
ON public.performance_metrics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own performance metrics" 
ON public.performance_metrics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own performance metrics" 
ON public.performance_metrics 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own performance metrics" 
ON public.performance_metrics 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_performance_metrics_updated_at
BEFORE UPDATE ON public.performance_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_performance_metrics_user_activity ON public.performance_metrics(user_id, activity_id);
CREATE INDEX idx_performance_metrics_calculated_at ON public.performance_metrics(calculated_at);