-- Fix the security definer view issue by removing SECURITY DEFINER
-- and implementing proper RLS policies instead

-- Drop the problematic view
DROP VIEW IF EXISTS public.public_profiles;

-- Remove the public policy we created earlier
DROP POLICY IF EXISTS "Public can view display profiles" ON profiles;

-- Keep only the secure policy for users to view their own profiles
-- This policy already exists: "Users can view their own profile"

-- For public profile display (avatars, display names), we'll handle this
-- in the application layer by only querying the specific fields needed
-- rather than creating a security definer view

-- Add file upload security: Update storage policies to be more restrictive
-- and add better validation

-- Update avatar storage policy to be more secure
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

-- Create more secure avatar policies
CREATE POLICY "Avatar images are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatars to their folder" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

CREATE POLICY "Users can update their own avatars" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatars" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);