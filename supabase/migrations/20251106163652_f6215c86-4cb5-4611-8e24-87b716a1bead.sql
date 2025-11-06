-- Create table for batch processing logs
CREATE TABLE IF NOT EXISTS overtraining_batch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_users_processed integer DEFAULT 0,
  successful_calculations integer DEFAULT 0,
  failed_calculations integer DEFAULT 0,
  execution_time_seconds integer,
  error_message text,
  batch_size integer,
  days_active_threshold integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE overtraining_batch_logs ENABLE ROW LEVEL SECURITY;

-- Service role can manage all logs
CREATE POLICY "Service role can manage batch logs"
  ON overtraining_batch_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can view all logs
CREATE POLICY "Admins can view batch logs"
  ON overtraining_batch_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_overtraining_batch_logs_started_at ON overtraining_batch_logs(started_at DESC);
CREATE INDEX idx_overtraining_batch_logs_status ON overtraining_batch_logs(status);