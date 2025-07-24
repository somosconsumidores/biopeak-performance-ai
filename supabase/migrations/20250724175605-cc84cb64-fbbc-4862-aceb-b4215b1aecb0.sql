-- Security Fix: Restrict profile visibility to protect user privacy
-- Drop the overly permissive policy that allows everyone to see all profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- Create a new policy that only allows users to view their own profiles
CREATE POLICY "Users can view their own profile" 
ON profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow public access only to non-sensitive profile fields for display purposes
CREATE POLICY "Public can view display profiles" 
ON profiles 
FOR SELECT 
TO public
USING (true);

-- However, we need to be more granular. Let's create a view for public data instead
-- First, let's create a public view that only exposes safe profile data
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  display_name,
  avatar_url,
  bio,
  created_at
FROM profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO public;
GRANT SELECT ON public.public_profiles TO authenticated;

-- Now update the profiles policy to be more restrictive
DROP POLICY IF EXISTS "Public can view display profiles" ON profiles;

-- Only allow users to see their own full profiles
-- Service functions can still access profiles as needed