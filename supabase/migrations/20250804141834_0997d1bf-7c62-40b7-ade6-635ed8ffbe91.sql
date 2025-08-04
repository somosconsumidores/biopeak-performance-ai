-- Add missing access_type column to user_access_logs table
ALTER TABLE user_access_logs 
ADD COLUMN access_type TEXT DEFAULT 'login' CHECK (access_type IN ('login', 'session_resume', 'app_resume'));