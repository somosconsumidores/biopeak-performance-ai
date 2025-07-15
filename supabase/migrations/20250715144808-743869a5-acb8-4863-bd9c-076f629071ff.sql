-- Add new columns to garmin_activity_details for samples data
ALTER TABLE public.garmin_activity_details 
ADD COLUMN heart_rate INTEGER,
ADD COLUMN latitude_in_degree DOUBLE PRECISION,
ADD COLUMN longitude_in_degree DOUBLE PRECISION,
ADD COLUMN elevation_in_meters DOUBLE PRECISION,
ADD COLUMN speed_meters_per_second DOUBLE PRECISION,
ADD COLUMN power_in_watts INTEGER,
ADD COLUMN total_distance_in_meters DOUBLE PRECISION,
ADD COLUMN steps_per_minute INTEGER,
ADD COLUMN clock_duration_in_seconds INTEGER,
ADD COLUMN moving_duration_in_seconds INTEGER,
ADD COLUMN timer_duration_in_seconds INTEGER;

-- Create function to extract samples data and populate columns
CREATE OR REPLACE FUNCTION public.extract_samples_data()
RETURNS void AS $$
BEGIN
  UPDATE public.garmin_activity_details 
  SET 
    heart_rate = CASE 
      WHEN samples ? 'heartRateInBeatsPerMinute' 
      THEN (samples->>'heartRateInBeatsPerMinute')::INTEGER 
      ELSE NULL 
    END,
    latitude_in_degree = CASE 
      WHEN samples ? 'latitudeInDegree' 
      THEN (samples->>'latitudeInDegree')::DOUBLE PRECISION 
      ELSE NULL 
    END,
    longitude_in_degree = CASE 
      WHEN samples ? 'longitudeInDegree' 
      THEN (samples->>'longitudeInDegree')::DOUBLE PRECISION 
      ELSE NULL 
    END,
    elevation_in_meters = CASE 
      WHEN samples ? 'elevationInMeters' 
      THEN (samples->>'elevationInMeters')::DOUBLE PRECISION 
      ELSE NULL 
    END,
    speed_meters_per_second = CASE 
      WHEN samples ? 'speedMetersPerSecond' 
      THEN (samples->>'speedMetersPerSecond')::DOUBLE PRECISION 
      ELSE NULL 
    END,
    power_in_watts = CASE 
      WHEN samples ? 'powerInWatts' 
      THEN (samples->>'powerInWatts')::INTEGER 
      ELSE NULL 
    END,
    total_distance_in_meters = CASE 
      WHEN samples ? 'totalDistanceInMeters' 
      THEN (samples->>'totalDistanceInMeters')::DOUBLE PRECISION 
      ELSE NULL 
    END,
    steps_per_minute = CASE 
      WHEN samples ? 'stepsPerMinute' 
      THEN (samples->>'stepsPerMinute')::INTEGER 
      ELSE NULL 
    END,
    clock_duration_in_seconds = CASE 
      WHEN samples ? 'clockDurationInSeconds' 
      THEN (samples->>'clockDurationInSeconds')::INTEGER 
      ELSE NULL 
    END,
    moving_duration_in_seconds = CASE 
      WHEN samples ? 'movingDurationInSeconds' 
      THEN (samples->>'movingDurationInSeconds')::INTEGER 
      ELSE NULL 
    END,
    timer_duration_in_seconds = CASE 
      WHEN samples ? 'timerDurationInSeconds' 
      THEN (samples->>'timerDurationInSeconds')::INTEGER 
      ELSE NULL 
    END
  WHERE samples IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to populate existing data
SELECT public.extract_samples_data();

-- Create indexes for optimization
CREATE INDEX idx_garmin_activity_details_heart_rate ON public.garmin_activity_details(heart_rate);
CREATE INDEX idx_garmin_activity_details_speed ON public.garmin_activity_details(speed_meters_per_second);
CREATE INDEX idx_garmin_activity_details_power ON public.garmin_activity_details(power_in_watts);
CREATE INDEX idx_garmin_activity_details_elevation ON public.garmin_activity_details(elevation_in_meters);
CREATE INDEX idx_garmin_activity_details_location ON public.garmin_activity_details(latitude_in_degree, longitude_in_degree);

-- Drop the extraction function as it's no longer needed
DROP FUNCTION public.extract_samples_data();