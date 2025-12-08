-- Delete user 0f4c3e66-403e-4dee-9fd0-01017e2403ab from all_activities
DELETE FROM public.all_activities WHERE user_id = '0f4c3e66-403e-4dee-9fd0-01017e2403ab';

-- Delete user from garmin_tokens
DELETE FROM public.garmin_tokens WHERE user_id = '0f4c3e66-403e-4dee-9fd0-01017e2403ab';

-- Delete user from profiles
DELETE FROM public.profiles WHERE id = '0f4c3e66-403e-4dee-9fd0-01017e2403ab';