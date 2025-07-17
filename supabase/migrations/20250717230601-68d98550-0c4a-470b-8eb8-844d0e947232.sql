-- Fix RLS policies for performance_metrics table to allow service role operations
-- and add unique constraint to prevent duplicates

-- First, add the unique constraint on (user_id, activity_id)
ALTER TABLE public.performance_metrics 
ADD CONSTRAINT performance_metrics_user_activity_unique 
UNIQUE (user_id, activity_id);

-- Drop existing RLS policies that might be too restrictive
DROP POLICY IF EXISTS "Users can insert their own performance metrics" ON public.performance_metrics;
DROP POLICY IF EXISTS "Users can update their own performance metrics" ON public.performance_metrics;

-- Create new RLS policies that allow both user access and service role access
CREATE POLICY "Users and service role can insert performance metrics" 
ON public.performance_metrics 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR 
  auth.jwt() ->> 'role' = 'service_role'
);

CREATE POLICY "Users and service role can update performance metrics" 
ON public.performance_metrics 
FOR UPDATE 
USING (
  auth.uid() = user_id OR 
  auth.jwt() ->> 'role' = 'service_role'
);

-- Clean up duplicate records - keep only the correct user's record
DELETE FROM public.performance_metrics 
WHERE activity_id = '19760656535' 
AND user_id != 'e1257b1b-9e53-408e-82ed-c856706bb6b1';