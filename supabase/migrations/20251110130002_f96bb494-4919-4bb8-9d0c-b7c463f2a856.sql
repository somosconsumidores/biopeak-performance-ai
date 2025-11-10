-- Add cycling support to training plans
ALTER TABLE public.training_plans
ADD COLUMN IF NOT EXISTS sport_type text NOT NULL DEFAULT 'running'
CHECK (sport_type IN ('running', 'cycling'));

-- Add cycling-specific fields
ALTER TABLE public.training_plans
ADD COLUMN IF NOT EXISTS ftp_watts integer,
ADD COLUMN IF NOT EXISTS equipment_type text
CHECK (equipment_type IS NULL OR equipment_type IN ('road', 'mtb', 'trainer', 'mixed'));

-- Create table for cycling power zones
CREATE TABLE IF NOT EXISTS public.cycling_power_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.training_plans(id) ON DELETE CASCADE,
  ftp_watts integer NOT NULL,
  z1_min integer,
  z1_max integer,
  z2_min integer,
  z2_max integer,
  z3_min integer,
  z3_max integer,
  z4_min integer,
  z4_max integer,
  z5_min integer,
  z5_max integer,
  z6_min integer,
  z6_max integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cycling_power_zones ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own power zones"
ON public.cycling_power_zones FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own power zones"
ON public.cycling_power_zones FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own power zones"
ON public.cycling_power_zones FOR UPDATE
USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_training_plans_sport_type 
ON public.training_plans(sport_type, user_id, status);

CREATE INDEX IF NOT EXISTS idx_cycling_power_zones_user_plan 
ON public.cycling_power_zones(user_id, plan_id);