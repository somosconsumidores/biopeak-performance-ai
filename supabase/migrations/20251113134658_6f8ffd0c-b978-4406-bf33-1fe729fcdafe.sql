-- Enable realtime for training_plan_workouts table
ALTER TABLE public.training_plan_workouts REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_plan_workouts;