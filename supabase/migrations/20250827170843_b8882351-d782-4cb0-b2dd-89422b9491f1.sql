-- Create user_target_races table
CREATE TABLE public.user_target_races (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  race_name TEXT NOT NULL,
  race_date DATE NOT NULL,
  distance_meters INTEGER NOT NULL,
  target_time_minutes INTEGER, -- Target time in minutes
  race_location TEXT,
  race_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned, completed, cancelled
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create race_progress_snapshots table
CREATE TABLE public.race_progress_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  race_id UUID NOT NULL REFERENCES public.user_target_races(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  estimated_time_minutes INTEGER, -- AI estimated time based on current fitness
  fitness_level TEXT, -- beginner, intermediate, advanced, elite
  readiness_score NUMERIC, -- 0-100 score indicating race readiness
  gap_analysis JSONB, -- Analysis of gaps between target and estimated times
  improvement_suggestions JSONB, -- AI suggestions for improvement
  training_focus_areas TEXT[], -- Areas that need focus (speed, endurance, etc.)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_target_races ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_progress_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_target_races
CREATE POLICY "Users can view their own target races"
ON public.user_target_races
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own target races"
ON public.user_target_races
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own target races"
ON public.user_target_races
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own target races"
ON public.user_target_races
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for race_progress_snapshots
CREATE POLICY "Users can view their own race progress"
ON public.race_progress_snapshots
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own race progress"
ON public.race_progress_snapshots
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all race progress"
ON public.race_progress_snapshots
FOR ALL
USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_user_target_races_user_id ON public.user_target_races(user_id);
CREATE INDEX idx_user_target_races_race_date ON public.user_target_races(race_date);
CREATE INDEX idx_race_progress_snapshots_race_id ON public.race_progress_snapshots(race_id);
CREATE INDEX idx_race_progress_snapshots_user_id ON public.race_progress_snapshots(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_target_races_updated_at
BEFORE UPDATE ON public.user_target_races
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();