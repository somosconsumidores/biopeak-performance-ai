
-- Add garmin_user_id column to store the official Garmin User API ID
ALTER TABLE garmin_tokens 
ADD COLUMN IF NOT EXISTS garmin_user_id TEXT;

-- Create index for better performance on webhook lookups
CREATE INDEX IF NOT EXISTS idx_garmin_tokens_garmin_user_id 
ON garmin_tokens(garmin_user_id);

-- Add comment to clarify the purpose of the new column
COMMENT ON COLUMN garmin_tokens.garmin_user_id IS 'Official Garmin User API ID used for webhook association - different from garminGuid in token_secret';
