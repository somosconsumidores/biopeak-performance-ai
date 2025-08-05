-- Add athlete_id column to strava_tokens table if it doesn't exist
ALTER TABLE public.strava_tokens 
ADD COLUMN IF NOT EXISTS athlete_id BIGINT;

-- Update the existing record for the user who already authenticated
UPDATE public.strava_tokens 
SET athlete_id = 175370011
WHERE user_id = 'bba58ddb-5894-422b-81a8-4b688058d0a7';