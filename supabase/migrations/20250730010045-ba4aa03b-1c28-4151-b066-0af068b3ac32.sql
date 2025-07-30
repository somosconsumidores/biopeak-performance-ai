-- Add admin policy to garmin_tokens table to allow admins to view all tokens
CREATE POLICY "Admins can view all garmin tokens" 
ON public.garmin_tokens 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));