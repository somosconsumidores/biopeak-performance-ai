-- Add activity_date column to garmin_activities table
ALTER TABLE public.garmin_activities 
ADD COLUMN activity_date DATE;

-- Create function to calculate activity date from start_time_in_seconds
CREATE OR REPLACE FUNCTION public.calculate_activity_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert Unix timestamp to date (assuming UTC timezone)
  IF NEW.start_time_in_seconds IS NOT NULL THEN
    NEW.activity_date = DATE(to_timestamp(NEW.start_time_in_seconds));
  ELSE
    NEW.activity_date = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate activity_date on insert/update
CREATE TRIGGER calculate_activity_date_trigger
  BEFORE INSERT OR UPDATE ON public.garmin_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_activity_date();

-- Update existing records to populate the activity_date column
UPDATE public.garmin_activities 
SET activity_date = DATE(to_timestamp(start_time_in_seconds))
WHERE start_time_in_seconds IS NOT NULL;