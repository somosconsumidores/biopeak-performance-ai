-- Create table for saved race strategies
CREATE TABLE public.race_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_name TEXT NOT NULL,
  distance_km NUMERIC NOT NULL,
  objective_type TEXT NOT NULL CHECK (objective_type IN ('time', 'pace')),
  target_time_seconds INTEGER,
  target_pace_seconds INTEGER,
  strategy_type TEXT NOT NULL CHECK (strategy_type IN ('constant', 'negative', 'positive')),
  intensity_percentage INTEGER NOT NULL DEFAULT 10,
  km_distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_time_seconds INTEGER NOT NULL,
  avg_pace_seconds INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.race_strategies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own race strategies"
  ON public.race_strategies
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own race strategies"
  ON public.race_strategies
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own race strategies"
  ON public.race_strategies
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own race strategies"
  ON public.race_strategies
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_race_strategies_user_id ON public.race_strategies(user_id);
CREATE INDEX idx_race_strategies_created_at ON public.race_strategies(created_at DESC);