-- Purge all data from Garmin activity details as requested
-- Fast, metadata-only operation (reclaims space internally) and bypasses RLS
TRUNCATE TABLE public.garmin_activity_details;