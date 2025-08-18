-- Create fitness_scores_daily table for BioPeak proprietary fitness score
CREATE TABLE public.fitness_scores_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  calendar_date DATE NOT NULL,
  fitness_score NUMERIC(5,2) NOT NULL,
  capacity_score NUMERIC(5,2) NOT NULL,
  consistency_score NUMERIC(5,2) NOT NULL,
  recovery_balance_score NUMERIC(5,2) NOT NULL,
  daily_strain NUMERIC(8,2) NOT NULL,
  atl_7day NUMERIC(8,2) NOT NULL,
  ctl_42day NUMERIC(8,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_date UNIQUE (user_id, calendar_date)
);

-- Enable Row Level Security
ALTER TABLE public.fitness_scores_daily ENABLE ROW LEVEL SECURITY;

-- Create policies for fitness scores
CREATE POLICY "Users can view their own fitness scores" 
ON public.fitness_scores_daily 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fitness scores" 
ON public.fitness_scores_daily 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fitness scores" 
ON public.fitness_scores_daily 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all fitness scores" 
ON public.fitness_scores_daily 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Create index for efficient queries
CREATE INDEX idx_fitness_scores_user_date ON public.fitness_scores_daily (user_id, calendar_date DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_fitness_scores_daily_updated_at
BEFORE UPDATE ON public.fitness_scores_daily
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();