-- Change vo2_max_running from integer to numeric (keeps existing data)
ALTER TABLE public.garmin_vo2max
ALTER COLUMN vo2_max_running TYPE numeric USING vo2_max_running::numeric;