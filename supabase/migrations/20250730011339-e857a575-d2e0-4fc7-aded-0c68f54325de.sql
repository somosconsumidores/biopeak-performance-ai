-- Add admin policies to allow viewing all data for statistics

-- Profiles table - allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Garmin activities table - allow admins to view all activities
CREATE POLICY "Admins can view all garmin activities" 
ON public.garmin_activities 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- User commitments table - allow admins to view all commitments
CREATE POLICY "Admins can view all user commitments" 
ON public.user_commitments 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));