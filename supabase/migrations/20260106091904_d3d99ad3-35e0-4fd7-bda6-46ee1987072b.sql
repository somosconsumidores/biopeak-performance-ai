-- Add custom heart rate zone configuration to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS max_heart_rate INTEGER,
ADD COLUMN IF NOT EXISTS hr_zones JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.max_heart_rate IS 'User-defined maximum heart rate in bpm';
COMMENT ON COLUMN public.profiles.hr_zones IS 'Custom HR zone configuration with minPercent, maxPercent, and label for each zone';