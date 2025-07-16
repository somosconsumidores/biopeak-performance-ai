-- Add vo2_max column to garmin_activities table
ALTER TABLE public.garmin_activities 
ADD COLUMN vo2_max DECIMAL(4,1);

-- Add comment explaining the column
COMMENT ON COLUMN public.garmin_activities.vo2_max IS 'Estimated VO2 max in ml/kg/min for running activities only';

-- Create function to calculate VO2max using Garmin-calibrated formula
CREATE OR REPLACE FUNCTION public.calculate_vo2_max(
  activity_type_param TEXT,
  pace_min_km DECIMAL,
  avg_hr INTEGER,
  max_hr INTEGER
) RETURNS DECIMAL(4,1)
LANGUAGE plpgsql
AS $$
DECLARE
  calibration_factor CONSTANT DECIMAL := 16;
  speed_m_per_min DECIMAL;
  vo2_theoretical DECIMAL;
  effort_ratio DECIMAL;
  vo2_result DECIMAL;
BEGIN
  -- Only calculate for running activities
  IF activity_type_param IS NULL OR LOWER(activity_type_param) NOT LIKE '%run%' THEN
    RETURN NULL;
  END IF;
  
  -- Validate input parameters
  IF pace_min_km IS NULL OR pace_min_km <= 0 OR 
     avg_hr IS NULL OR avg_hr <= 0 OR 
     max_hr IS NULL OR max_hr <= 0 THEN
    RETURN NULL;
  END IF;
  
  -- Calculate VO2max using the provided formula
  speed_m_per_min := 1000 / pace_min_km;
  vo2_theoretical := 3.5 * speed_m_per_min;
  effort_ratio := avg_hr::DECIMAL / max_hr::DECIMAL;
  
  vo2_result := vo2_theoretical / effort_ratio / calibration_factor;
  
  -- Return rounded to 1 decimal place
  RETURN ROUND(vo2_result, 1);
END;
$$;

-- Create trigger function to auto-calculate VO2max on insert/update
CREATE OR REPLACE FUNCTION public.auto_calculate_vo2_max()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate VO2max when inserting or updating running activities
  NEW.vo2_max := public.calculate_vo2_max(
    NEW.activity_type,
    NEW.average_pace_in_minutes_per_kilometer,
    NEW.average_heart_rate_in_beats_per_minute,
    NEW.max_heart_rate_in_beats_per_minute
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically calculate VO2max
CREATE TRIGGER calculate_vo2_max_trigger
  BEFORE INSERT OR UPDATE ON public.garmin_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_vo2_max();

-- Update existing running activities with VO2max calculation
UPDATE public.garmin_activities 
SET vo2_max = public.calculate_vo2_max(
  activity_type,
  average_pace_in_minutes_per_kilometer,
  average_heart_rate_in_beats_per_minute,
  max_heart_rate_in_beats_per_minute
)
WHERE activity_type IS NOT NULL 
  AND LOWER(activity_type) LIKE '%run%'
  AND average_pace_in_minutes_per_kilometer IS NOT NULL
  AND average_heart_rate_in_beats_per_minute IS NOT NULL
  AND max_heart_rate_in_beats_per_minute IS NOT NULL;