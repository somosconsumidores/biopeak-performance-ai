-- Update the calculate_activity_date function to consider local timezone offset
CREATE OR REPLACE FUNCTION public.calculate_activity_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert Unix timestamp to date considering local timezone offset
  IF NEW.start_time_in_seconds IS NOT NULL THEN
    IF NEW.start_time_offset_in_seconds IS NOT NULL THEN
      NEW.activity_date = DATE(to_timestamp(NEW.start_time_in_seconds) + INTERVAL '1 second' * NEW.start_time_offset_in_seconds);
    ELSE
      NEW.activity_date = DATE(to_timestamp(NEW.start_time_in_seconds));
    END IF;
  ELSE
    NEW.activity_date = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing records to use the corrected activity_date calculation
UPDATE public.garmin_activities 
SET activity_date = CASE 
  WHEN start_time_in_seconds IS NOT NULL AND start_time_offset_in_seconds IS NOT NULL THEN
    DATE(to_timestamp(start_time_in_seconds) + INTERVAL '1 second' * start_time_offset_in_seconds)
  WHEN start_time_in_seconds IS NOT NULL THEN
    DATE(to_timestamp(start_time_in_seconds))
  ELSE
    NULL
END
WHERE start_time_in_seconds IS NOT NULL;