-- Create training sessions table
CREATE TABLE public.training_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('free_run', 'target_distance', 'target_pace', 'target_duration', 'target_calories')),
  goal_data JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  total_distance_meters NUMERIC,
  total_duration_seconds INTEGER,
  average_pace_min_km NUMERIC,
  average_heart_rate INTEGER,
  calories_burned INTEGER,
  goal_achieved BOOLEAN DEFAULT false,
  subjective_feedback JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create realtime feedbacks table
CREATE TABLE public.realtime_feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  audio_url TEXT,
  triggered_at_distance_meters NUMERIC NOT NULL,
  triggered_at_duration_seconds INTEGER NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('pace_adjustment', 'motivation', 'goal_progress', 'heart_rate', 'strategy_change')),
  performance_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI prescriptions table
CREATE TABLE public.ai_prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  planned_strategy JSONB NOT NULL DEFAULT '{}',
  actual_performance JSONB NOT NULL DEFAULT '{}',
  adjustments_made JSONB NOT NULL DEFAULT '{}',
  goal_feasibility_score NUMERIC CHECK (goal_feasibility_score >= 0 AND goal_feasibility_score <= 1),
  recommended_pace_min_km NUMERIC,
  recommended_heart_rate_zone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create performance snapshots table
CREATE TABLE public.performance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  snapshot_at_distance_meters NUMERIC NOT NULL,
  snapshot_at_duration_seconds INTEGER NOT NULL,
  current_pace_min_km NUMERIC,
  current_heart_rate INTEGER,
  current_speed_ms NUMERIC,
  elevation_meters NUMERIC,
  latitude NUMERIC,
  longitude NUMERIC,
  calories_burned_so_far INTEGER,
  deviation_from_target JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtime_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for training_sessions
CREATE POLICY "Users can view their own training sessions" 
ON public.training_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training sessions" 
ON public.training_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training sessions" 
ON public.training_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training sessions" 
ON public.training_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for realtime_feedbacks
CREATE POLICY "Users can view their own realtime feedbacks" 
ON public.realtime_feedbacks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.training_sessions 
  WHERE id = session_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create their own realtime feedbacks" 
ON public.realtime_feedbacks 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.training_sessions 
  WHERE id = session_id AND user_id = auth.uid()
));

-- Create RLS policies for ai_prescriptions
CREATE POLICY "Users can view their own ai prescriptions" 
ON public.ai_prescriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.training_sessions 
  WHERE id = session_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create their own ai prescriptions" 
ON public.ai_prescriptions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.training_sessions 
  WHERE id = session_id AND user_id = auth.uid()
));

CREATE POLICY "Users can update their own ai prescriptions" 
ON public.ai_prescriptions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.training_sessions 
  WHERE id = session_id AND user_id = auth.uid()
));

-- Create RLS policies for performance_snapshots
CREATE POLICY "Users can view their own performance snapshots" 
ON public.performance_snapshots 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.training_sessions 
  WHERE id = session_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create their own performance snapshots" 
ON public.performance_snapshots 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.training_sessions 
  WHERE id = session_id AND user_id = auth.uid()
));

-- Create indexes for better performance
CREATE INDEX idx_training_sessions_user_id ON public.training_sessions(user_id);
CREATE INDEX idx_training_sessions_status ON public.training_sessions(status);
CREATE INDEX idx_realtime_feedbacks_session_id ON public.realtime_feedbacks(session_id);
CREATE INDEX idx_ai_prescriptions_session_id ON public.ai_prescriptions(session_id);
CREATE INDEX idx_performance_snapshots_session_id ON public.performance_snapshots(session_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_training_sessions_updated_at
BEFORE UPDATE ON public.training_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_prescriptions_updated_at
BEFORE UPDATE ON public.ai_prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();