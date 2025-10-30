-- Add workout_id column to training_sessions table to link with training_plan_workouts
ALTER TABLE public.training_sessions
ADD COLUMN workout_id UUID REFERENCES public.training_plan_workouts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_training_sessions_workout_id ON public.training_sessions(workout_id);