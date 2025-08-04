-- Insert missing user into profiles table
INSERT INTO public.profiles (user_id, email, display_name, created_at, updated_at)
VALUES (
  '6659197c-19c0-4156-87af-52d0a0a3a58b'::uuid,
  'andrelbflor@gmail.com',
  'André Flores',
  now(),
  now()
);