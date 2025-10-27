-- Add resolved_at column to coach_events table
ALTER TABLE coach_events 
ADD COLUMN resolved_at timestamp with time zone DEFAULT NULL;