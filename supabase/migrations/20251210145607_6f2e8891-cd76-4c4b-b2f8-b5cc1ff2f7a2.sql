-- Enable REPLICA IDENTITY FULL for garmin_tokens to capture all columns in realtime events
ALTER TABLE garmin_tokens REPLICA IDENTITY FULL;

-- Add garmin_tokens to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE garmin_tokens;