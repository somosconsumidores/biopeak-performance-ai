-- Fix heart_rate extraction from samples JSON
UPDATE public.garmin_activity_details 
SET heart_rate = CASE 
  WHEN samples ? 'heartRate' 
  THEN (samples->>'heartRate')::INTEGER 
  ELSE NULL 
END
WHERE samples IS NOT NULL AND heart_rate IS NULL;