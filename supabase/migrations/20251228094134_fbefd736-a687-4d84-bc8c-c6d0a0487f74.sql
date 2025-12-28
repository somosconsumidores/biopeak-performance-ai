-- ============================================================
-- Fix: Remove all conflicting versions of upsert_activity_coordinates
-- ============================================================

-- Drop all possible overloads by exact signature
DROP FUNCTION IF EXISTS public.upsert_activity_coordinates(
  uuid, text, text, jsonb, integer, integer, 
  numeric, numeric, jsonb
);

DROP FUNCTION IF EXISTS public.upsert_activity_coordinates(
  uuid, text, text, jsonb, integer, integer, 
  jsonb, double precision, double precision
);

DROP FUNCTION IF EXISTS public.upsert_activity_coordinates(
  uuid, text, text, jsonb, integer, integer, 
  double precision, double precision, jsonb
);

-- Also try dropping without specific signatures (catches any remaining)
DROP FUNCTION IF EXISTS public.upsert_activity_coordinates(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text,
  p_coordinates jsonb,
  p_total_points integer,
  p_sampled_points integer,
  p_starting_latitude double precision,
  p_starting_longitude double precision,
  p_bounding_box jsonb
);

-- ============================================================
-- Recreate the SINGLE canonical version (no DEFAULT values)
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_activity_coordinates(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text,
  p_coordinates jsonb,
  p_total_points integer,
  p_sampled_points integer,
  p_starting_latitude double precision,
  p_starting_longitude double precision,
  p_bounding_box jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO activity_coordinates (
    user_id,
    activity_id,
    activity_source,
    coordinates,
    total_points,
    sampled_points,
    starting_latitude,
    starting_longitude,
    bounding_box,
    created_at
  ) VALUES (
    p_user_id,
    p_activity_id,
    p_activity_source,
    p_coordinates,
    p_total_points,
    p_sampled_points,
    p_starting_latitude,
    p_starting_longitude,
    p_bounding_box,
    now()
  )
  ON CONFLICT (user_id, activity_source, activity_id)
  DO UPDATE SET
    coordinates = EXCLUDED.coordinates,
    total_points = EXCLUDED.total_points,
    sampled_points = EXCLUDED.sampled_points,
    starting_latitude = EXCLUDED.starting_latitude,
    starting_longitude = EXCLUDED.starting_longitude,
    bounding_box = EXCLUDED.bounding_box;
END;
$$;