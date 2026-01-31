-- Create table for HealthKit sleep data
CREATE TABLE public.healthkit_sleep_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  calendar_date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  in_bed_seconds INTEGER DEFAULT 0,
  total_sleep_seconds INTEGER DEFAULT 0,
  deep_sleep_seconds INTEGER DEFAULT 0,
  light_sleep_seconds INTEGER DEFAULT 0,
  rem_sleep_seconds INTEGER DEFAULT 0,
  awake_seconds INTEGER DEFAULT 0,
  sleep_score INTEGER,
  source_name TEXT DEFAULT 'Apple Watch',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, calendar_date)
);

-- Add index for efficient queries
CREATE INDEX idx_healthkit_sleep_user_date ON public.healthkit_sleep_summaries(user_id, calendar_date DESC);

-- Enable RLS
ALTER TABLE public.healthkit_sleep_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sleep data"
ON public.healthkit_sleep_summaries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sleep data"
ON public.healthkit_sleep_summaries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sleep data"
ON public.healthkit_sleep_summaries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sleep data"
ON public.healthkit_sleep_summaries FOR DELETE
USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.healthkit_sleep_summaries IS 'Sleep data synchronized from Apple HealthKit';