-- Create overtraining_scores table
CREATE TABLE public.overtraining_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  score NUMERIC NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('low', 'medium', 'high')),
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation TEXT,
  
  -- Detailed metrics
  training_load_score NUMERIC,
  frequency_score NUMERIC,
  intensity_score NUMERIC,
  volume_trend_score NUMERIC,
  
  activities_analyzed INTEGER NOT NULL DEFAULT 0,
  days_analyzed INTEGER NOT NULL DEFAULT 30,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.overtraining_scores ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own overtraining scores"
  ON public.overtraining_scores
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own overtraining scores"
  ON public.overtraining_scores
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all overtraining scores"
  ON public.overtraining_scores
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for faster queries
CREATE INDEX idx_overtraining_scores_user_calculated 
  ON public.overtraining_scores(user_id, calculated_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_overtraining_scores_updated_at
  BEFORE UPDATE ON public.overtraining_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();