-- Create table to track backfill requests and their status
CREATE TABLE public.garmin_backfill_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  garmin_user_id TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('activities', 'activity_details')),
  time_range_start BIGINT NOT NULL,
  time_range_end BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'in_progress', 'completed', 'failed')),
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  activities_received INTEGER DEFAULT 0,
  activity_details_received INTEGER DEFAULT 0,
  webhook_notifications JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.garmin_backfill_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own backfill requests" 
ON public.garmin_backfill_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backfill requests" 
ON public.garmin_backfill_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backfill requests" 
ON public.garmin_backfill_requests 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_garmin_backfill_requests_updated_at
BEFORE UPDATE ON public.garmin_backfill_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_garmin_backfill_requests_user_id ON public.garmin_backfill_requests(user_id);
CREATE INDEX idx_garmin_backfill_requests_status ON public.garmin_backfill_requests(status);
CREATE INDEX idx_garmin_backfill_requests_garmin_user_id ON public.garmin_backfill_requests(garmin_user_id);
CREATE INDEX idx_garmin_backfill_requests_triggered_at ON public.garmin_backfill_requests(triggered_at);