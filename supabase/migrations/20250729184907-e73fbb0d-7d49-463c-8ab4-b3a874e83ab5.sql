-- FASE 4: Create health reports table for monitoring
CREATE TABLE IF NOT EXISTS public.garmin_health_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_data JSONB NOT NULL,
  status TEXT NOT NULL,
  total_calls INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  suspicious_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.garmin_health_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for health reports
CREATE POLICY "System can manage health reports" 
ON public.garmin_health_reports 
FOR ALL 
USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_garmin_health_reports_status ON public.garmin_health_reports(status);
CREATE INDEX IF NOT EXISTS idx_garmin_health_reports_created_at ON public.garmin_health_reports(created_at);

-- Fix search path for existing functions
ALTER FUNCTION cleanup_old_rate_limits() SET search_path = public;
ALTER FUNCTION cleanup_old_function_calls() SET search_path = public;