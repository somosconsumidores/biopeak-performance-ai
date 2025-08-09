-- Add missing heart rate columns to polar_activities table
ALTER TABLE public.polar_activities 
ADD COLUMN IF NOT EXISTS average_heart_rate_bpm integer,
ADD COLUMN IF NOT EXISTS maximum_heart_rate_bpm integer,
ADD COLUMN IF NOT EXISTS minimum_heart_rate_bpm integer;