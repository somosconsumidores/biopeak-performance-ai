-- Migration to fix onboarding logic and mark existing users as completed

-- First, create an index for better performance on onboarding checks
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed 
ON public.profiles (user_id, onboarding_completed);

-- Mark existing users as having completed onboarding if they have any activity data
-- This prevents existing users from being forced through onboarding again
UPDATE public.profiles 
SET onboarding_completed = true, updated_at = now()
WHERE user_id IN (
  -- Users who have Garmin activities
  SELECT DISTINCT user_id FROM public.garmin_activities
  UNION
  -- Users who have Strava activities  
  SELECT DISTINCT user_id FROM public.strava_activities
  UNION
  -- Users who have Polar activities
  SELECT DISTINCT user_id FROM public.polar_activities
  UNION
  -- Users who have any tokens (meaning they've connected services)
  SELECT DISTINCT user_id FROM public.garmin_tokens WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM public.strava_tokens WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id FROM public.polar_tokens WHERE user_id IS NOT NULL
)
AND (onboarding_completed IS NULL OR onboarding_completed = false);

-- Create a function to automatically mark users as onboarding complete when they have meaningful data
CREATE OR REPLACE FUNCTION public.auto_complete_onboarding_for_active_users()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user gets their first activity or token, mark onboarding as complete
  -- This handles edge cases where new users might get data before completing onboarding
  UPDATE public.profiles 
  SET onboarding_completed = true, updated_at = now()
  WHERE user_id = NEW.user_id 
    AND (onboarding_completed IS NULL OR onboarding_completed = false);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;