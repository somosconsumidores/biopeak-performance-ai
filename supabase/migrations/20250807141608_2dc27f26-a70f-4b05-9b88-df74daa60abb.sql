-- Create table for storing best 1km segments per activity
CREATE TABLE public.activity_best_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  activity_date DATE,
  best_1km_pace_min_km NUMERIC,
  segment_start_distance_meters NUMERIC,
  segment_end_distance_meters NUMERIC,
  segment_duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_activity_segment UNIQUE(user_id, activity_id)
);

-- Enable Row Level Security
ALTER TABLE public.activity_best_segments ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own best segments" 
ON public.activity_best_segments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own best segments" 
ON public.activity_best_segments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own best segments" 
ON public.activity_best_segments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own best segments" 
ON public.activity_best_segments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Service role can manage all segments for processing
CREATE POLICY "Service role can manage all best segments" 
ON public.activity_best_segments 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_activity_best_segments_updated_at
BEFORE UPDATE ON public.activity_best_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();