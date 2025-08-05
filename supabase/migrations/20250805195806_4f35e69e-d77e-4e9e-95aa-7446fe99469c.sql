-- Create table for Strava activity details/streams
CREATE TABLE public.strava_activity_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_activity_id BIGINT NOT NULL,
  latlng JSONB,
  heartrate JSONB,
  velocity_smooth JSONB,
  cadence JSONB,
  watts JSONB,
  distance JSONB,
  time JSONB,
  grade_smooth JSONB,
  temp JSONB,
  moving JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, strava_activity_id)
);

-- Enable RLS
ALTER TABLE public.strava_activity_details ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own strava activity details"
ON public.strava_activity_details
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strava activity details"
ON public.strava_activity_details
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strava activity details"
ON public.strava_activity_details
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strava activity details"
ON public.strava_activity_details
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_strava_activity_details_updated_at
BEFORE UPDATE ON public.strava_activity_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();