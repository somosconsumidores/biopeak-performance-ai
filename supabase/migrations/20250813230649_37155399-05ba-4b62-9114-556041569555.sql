-- Add missing max_hr column to performance_metrics table
ALTER TABLE public.performance_metrics 
ADD COLUMN max_hr integer;