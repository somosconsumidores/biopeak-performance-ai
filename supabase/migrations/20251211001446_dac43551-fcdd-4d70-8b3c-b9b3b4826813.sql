-- Create swimming_css_zones table for storing CSS data
CREATE TABLE IF NOT EXISTS public.swimming_css_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.training_plans(id) ON DELETE CASCADE,
  css_seconds_per_100m NUMERIC NOT NULL,
  z1_seconds NUMERIC NOT NULL,
  z2_seconds NUMERIC NOT NULL,
  z3_seconds NUMERIC NOT NULL,
  z4_seconds NUMERIC NOT NULL,
  z5_seconds NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(plan_id)
);

-- Enable RLS
ALTER TABLE public.swimming_css_zones ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own CSS zones" 
ON public.swimming_css_zones 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own CSS zones" 
ON public.swimming_css_zones 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CSS zones" 
ON public.swimming_css_zones 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CSS zones" 
ON public.swimming_css_zones 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_swimming_css_zones_user_id ON public.swimming_css_zones(user_id);
CREATE INDEX idx_swimming_css_zones_plan_id ON public.swimming_css_zones(plan_id);