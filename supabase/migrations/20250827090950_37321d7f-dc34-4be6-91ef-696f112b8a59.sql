-- Add fields to training_plans table for storing plan summary and target goals
ALTER TABLE public.training_plans 
ADD COLUMN plan_summary JSONB DEFAULT NULL,
ADD COLUMN goal_target_time_minutes INTEGER DEFAULT NULL;