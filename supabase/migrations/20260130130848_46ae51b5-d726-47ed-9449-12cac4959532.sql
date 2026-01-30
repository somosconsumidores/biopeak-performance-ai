-- Create table for storing average pace history
CREATE TABLE public.average_pace (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('RUNNING', 'CYCLING', 'SWIMMING')),
  average_pace_value DOUBLE PRECISION NOT NULL,
  pace_unit TEXT NOT NULL,
  total_activities INTEGER NOT NULL DEFAULT 0,
  total_distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_time_minutes DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast historical queries
CREATE INDEX idx_average_pace_calculated_category ON public.average_pace (calculated_at, category);

-- Enable Row Level Security
ALTER TABLE public.average_pace ENABLE ROW LEVEL SECURITY;

-- Public read access (aggregated data without PII)
CREATE POLICY "Anyone can read average pace data"
  ON public.average_pace
  FOR SELECT
  USING (true);

-- Only service_role can insert (via Edge Function)
CREATE POLICY "Service role can insert average pace data"
  ON public.average_pace
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE public.average_pace IS 'Daily aggregated pace averages by activity category (RUNNING, CYCLING, SWIMMING) for the last 30 days';