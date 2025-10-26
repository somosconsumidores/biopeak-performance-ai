-- Add training_plan_accepted field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS training_plan_accepted BOOLEAN DEFAULT NULL;