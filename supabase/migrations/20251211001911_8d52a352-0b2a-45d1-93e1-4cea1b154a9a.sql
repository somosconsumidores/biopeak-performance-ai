-- Drop the existing check constraint
ALTER TABLE public.training_plans DROP CONSTRAINT IF EXISTS training_plans_sport_type_check;

-- Add updated check constraint with swimming and strength
ALTER TABLE public.training_plans ADD CONSTRAINT training_plans_sport_type_check 
CHECK (sport_type IN ('running', 'cycling', 'swimming', 'strength'));