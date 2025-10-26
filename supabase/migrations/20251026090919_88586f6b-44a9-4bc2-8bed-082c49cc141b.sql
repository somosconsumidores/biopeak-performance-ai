-- Add flag_training_plan field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS flag_training_plan boolean DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN profiles.flag_training_plan IS 'Flag indicating user wants to be notified when training plan feature is ready';