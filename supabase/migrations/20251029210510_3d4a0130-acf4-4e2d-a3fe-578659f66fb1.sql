-- Create strava_sync_jobs table to track background sync jobs
CREATE TABLE IF NOT EXISTS strava_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  activities_synced integer DEFAULT 0,
  total_activities integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_strava_sync_jobs_user_id ON strava_sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_sync_jobs_status ON strava_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_strava_sync_jobs_created_at ON strava_sync_jobs(created_at DESC);

-- RLS Policies
ALTER TABLE strava_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync jobs"
  ON strava_sync_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage sync jobs"
  ON strava_sync_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE strava_sync_jobs;

-- Function to cleanup old sync jobs (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_strava_sync_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM strava_sync_jobs
  WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;