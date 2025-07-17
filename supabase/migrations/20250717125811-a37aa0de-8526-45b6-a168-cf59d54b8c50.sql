-- Add activity_name column to garmin_activity_details table
ALTER TABLE public.garmin_activity_details 
ADD COLUMN activity_name TEXT;