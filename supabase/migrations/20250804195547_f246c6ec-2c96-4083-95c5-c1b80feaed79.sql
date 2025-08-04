-- Create table for storing global application settings
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can manage app settings
CREATE POLICY "Service role can manage app settings" 
ON public.app_settings 
FOR ALL 
USING (auth.role() = 'service_role');

-- Insert initial setting for polar webhook signature key
INSERT INTO public.app_settings (setting_key, setting_value) 
VALUES ('polar_webhook_signature_key', NULL)
ON CONFLICT (setting_key) DO NOTHING;