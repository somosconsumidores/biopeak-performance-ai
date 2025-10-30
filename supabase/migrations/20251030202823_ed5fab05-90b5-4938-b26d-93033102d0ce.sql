-- Add unique constraint to user_id in subscribers table
ALTER TABLE public.subscribers 
ADD CONSTRAINT subscribers_user_id_key UNIQUE (user_id);