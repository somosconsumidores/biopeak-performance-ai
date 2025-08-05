-- Drop the existing strava_activity_details table structure with JSONB columns
-- and recreate it to support individual time-point records

-- First, drop the existing table (we'll recreate it)
DROP TABLE IF EXISTS strava_activity_details;

-- Create new strava_activity_details table for individual time-point records
CREATE TABLE strava_activity_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_activity_id BIGINT NOT NULL,
  time_index INTEGER NOT NULL, -- Index of the time point in the stream
  time_seconds INTEGER, -- Time at this point in seconds
  latitude DOUBLE PRECISION, -- Individual lat value
  longitude DOUBLE PRECISION, -- Individual lng value
  heartrate INTEGER, -- Heart rate at this point
  velocity_smooth DOUBLE PRECISION, -- Velocity at this point
  cadence INTEGER, -- Cadence at this point
  watts INTEGER, -- Power at this point
  distance DOUBLE PRECISION, -- Distance at this point
  grade_smooth DOUBLE PRECISION, -- Grade at this point
  temp INTEGER, -- Temperature at this point
  moving BOOLEAN, -- Whether moving at this point
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE strava_activity_details ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own strava activity details" 
ON strava_activity_details 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strava activity details" 
ON strava_activity_details 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strava activity details" 
ON strava_activity_details 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strava activity details" 
ON strava_activity_details 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_strava_activity_details_user_activity 
ON strava_activity_details(user_id, strava_activity_id);

CREATE INDEX idx_strava_activity_details_time_index 
ON strava_activity_details(strava_activity_id, time_index);