-- Create polar_webhook_logs table
CREATE TABLE public.polar_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  polar_user_id BIGINT,
  webhook_type TEXT NOT NULL DEFAULT 'activities',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.polar_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own webhook logs" 
ON public.polar_webhook_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all webhook logs" 
ON public.polar_webhook_logs 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_polar_webhook_logs_user_id ON public.polar_webhook_logs(user_id);
CREATE INDEX idx_polar_webhook_logs_polar_user_id ON public.polar_webhook_logs(polar_user_id);
CREATE INDEX idx_polar_webhook_logs_status ON public.polar_webhook_logs(status);
CREATE INDEX idx_polar_webhook_logs_created_at ON public.polar_webhook_logs(created_at DESC);
CREATE INDEX idx_polar_webhook_logs_webhook_type ON public.polar_webhook_logs(webhook_type);

-- Create trigger for updated_at
CREATE TRIGGER update_polar_webhook_logs_updated_at
BEFORE UPDATE ON public.polar_webhook_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();