-- Create table for Garmin activity details
CREATE TABLE public.garmin_activity_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  summary_id TEXT NOT NULL,
  upload_time_in_seconds BIGINT,
  start_time_in_seconds BIGINT,
  duration_in_seconds INTEGER,
  activity_type TEXT,
  device_name TEXT,
  samples JSONB, -- Store the samples array as JSON
  activity_summary JSONB, -- Store the complete activity summary
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, summary_id)
);

-- Enable RLS
ALTER TABLE public.garmin_activity_details ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own activity details" 
ON public.garmin_activity_details 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity details" 
ON public.garmin_activity_details 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity details" 
ON public.garmin_activity_details 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity details" 
ON public.garmin_activity_details 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_garmin_activity_details_updated_at
BEFORE UPDATE ON public.garmin_activity_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_garmin_activity_details_user_id ON public.garmin_activity_details(user_id);
CREATE INDEX idx_garmin_activity_details_summary_id ON public.garmin_activity_details(summary_id);
CREATE INDEX idx_garmin_activity_details_upload_time ON public.garmin_activity_details(upload_time_in_seconds);