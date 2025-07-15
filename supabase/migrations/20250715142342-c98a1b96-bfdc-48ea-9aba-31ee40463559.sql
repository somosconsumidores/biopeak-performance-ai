-- Drop the existing unique constraint on (user_id, summary_id)
ALTER TABLE public.garmin_activity_details 
DROP CONSTRAINT IF EXISTS garmin_activity_details_user_id_summary_id_key;

-- Add a sample_timestamp column to identify individual samples
ALTER TABLE public.garmin_activity_details 
ADD COLUMN sample_timestamp BIGINT;

-- Create a new unique constraint on (user_id, summary_id, sample_timestamp)
-- This allows multiple samples per activity but prevents duplicate samples
ALTER TABLE public.garmin_activity_details 
ADD CONSTRAINT garmin_activity_details_user_id_summary_id_sample_timestamp_key 
UNIQUE (user_id, summary_id, sample_timestamp);

-- Create index for better performance on sample_timestamp
CREATE INDEX idx_garmin_activity_details_sample_timestamp 
ON public.garmin_activity_details(sample_timestamp);