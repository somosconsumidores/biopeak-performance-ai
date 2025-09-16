-- Create function to find the fastest 1km segment from activity chart data
CREATE OR REPLACE FUNCTION public.find_fastest_1km_segment(
  p_user_id uuid,
  p_activity_id text,
  p_activity_source text DEFAULT 'garmin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  series_data jsonb;
  data_point jsonb;
  current_point jsonb;
  next_point jsonb;
  
  current_distance numeric;
  next_distance numeric;
  current_pace numeric;
  current_speed numeric;
  
  segment_start_distance numeric;
  segment_end_distance numeric;
  segment_total_time numeric;
  segment_total_distance numeric;
  segment_avg_pace numeric;
  
  best_pace numeric := 999999;
  best_segment jsonb := '{}'::jsonb;
  
  points_array jsonb[];
  i integer;
  j integer;
  array_length integer;
BEGIN
  -- Get series data for the activity
  SELECT acd.series_data INTO series_data
  FROM public.activity_chart_data acd
  WHERE acd.user_id = p_user_id 
    AND acd.activity_id = p_activity_id 
    AND acd.activity_source = p_activity_source;
  
  -- Return null if no data found
  IF series_data IS NULL OR jsonb_array_length(series_data) = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Convert to array for easier processing
  SELECT array_agg(value ORDER BY (value->>'distance_meters')::numeric)
  INTO points_array
  FROM jsonb_array_elements(series_data) AS value
  WHERE value->>'distance_meters' IS NOT NULL 
    AND (value->>'distance_meters')::numeric >= 0;
  
  array_length := array_length(points_array, 1);
  
  -- Need at least 2 points
  IF array_length < 2 THEN
    RETURN NULL;
  END IF;
  
  -- Sliding window to find fastest 1km segment
  FOR i IN 1..array_length LOOP
    current_point := points_array[i];
    current_distance := (current_point->>'distance_meters')::numeric;
    
    -- Find the next point that's approximately 1000m ahead
    FOR j IN (i+1)..array_length LOOP
      next_point := points_array[j];
      next_distance := (next_point->>'distance_meters')::numeric;
      
      -- If we've found a segment of ~1000m or more
      IF (next_distance - current_distance) >= 1000 THEN
        -- Calculate segment metrics
        segment_start_distance := current_distance;
        segment_end_distance := next_distance;
        segment_total_distance := segment_end_distance - segment_start_distance;
        
        -- Calculate weighted average pace for this segment
        segment_total_time := 0;
        segment_avg_pace := 0;
        
        -- Sum up time and calculate average pace
        FOR k IN i..(j-1) LOOP
          current_point := points_array[k];
          next_point := points_array[k+1];
          
          -- Get pace (prefer pace_min_km, fallback to calculated from speed)
          current_pace := NULL;
          IF current_point->>'pace_min_km' IS NOT NULL THEN
            current_pace := (current_point->>'pace_min_km')::numeric;
          ELSIF current_point->>'speed_ms' IS NOT NULL THEN
            current_speed := (current_point->>'speed_ms')::numeric;
            IF current_speed > 0 THEN
              current_pace := (1000.0 / current_speed) / 60.0; -- Convert m/s to min/km
            END IF;
          END IF;
          
          -- Only include valid pace data
          IF current_pace IS NOT NULL AND current_pace > 0 AND current_pace < 30 THEN
            segment_total_time := segment_total_time + current_pace;
          END IF;
        END LOOP;
        
        -- Calculate average pace for the segment
        IF segment_total_time > 0 THEN
          segment_avg_pace := segment_total_time / (j - i);
          
          -- Check if this is the fastest segment so far
          IF segment_avg_pace < best_pace THEN
            best_pace := segment_avg_pace;
            best_segment := jsonb_build_object(
              'start_distance_m', segment_start_distance,
              'end_distance_m', segment_end_distance,
              'segment_length_m', segment_total_distance,
              'avg_pace_min_km', round(segment_avg_pace, 2),
              'duration_seconds', round(segment_avg_pace * (segment_total_distance / 1000.0) * 60, 0)
            );
          END IF;
        END IF;
        
        EXIT; -- Found a 1km+ segment, move to next starting point
      END IF;
    END LOOP;
  END LOOP;
  
  -- Return the best segment found, or null if none
  IF best_segment = '{}'::jsonb THEN
    RETURN NULL;
  ELSE
    RETURN best_segment;
  END IF;
END;
$$;