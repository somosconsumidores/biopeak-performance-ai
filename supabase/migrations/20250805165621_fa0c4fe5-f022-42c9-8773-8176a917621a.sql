-- Create strava_webhook_logs table to track webhook notifications
CREATE TABLE IF NOT EXISTS public.strava_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_type TEXT NOT NULL DEFAULT 'unknown',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  user_id UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strava_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook logs
CREATE POLICY "Service role can manage all webhook logs" 
ON public.strava_webhook_logs 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own webhook logs" 
ON public.strava_webhook_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add athlete_id to strava_tokens table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'strava_tokens' AND column_name = 'athlete_id') THEN
    ALTER TABLE public.strava_tokens ADD COLUMN athlete_id BIGINT;
  END IF;
END $$;

-- Add trigger for updated_at
CREATE TRIGGER update_strava_webhook_logs_updated_at
BEFORE UPDATE ON public.strava_webhook_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();