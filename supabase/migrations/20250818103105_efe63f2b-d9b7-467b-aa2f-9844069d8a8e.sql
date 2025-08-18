-- Change vo2_max_running to integer (no decimal places), rounding existing values
BEGIN;
ALTER TABLE public.garmin_vo2max
  ALTER COLUMN vo2_max_running TYPE integer
  USING ROUND(vo2_max_running)::integer;
COMMIT;