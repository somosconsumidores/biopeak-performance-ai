-- Fix security warnings by setting search_path and installing extensions in extensions schema
ALTER FUNCTION force_renew_expired_tokens() SET search_path = '';
ALTER FUNCTION get_cron_job_status() SET search_path = '';

-- Install extensions in extensions schema if they don't exist
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Drop existing extensions from public schema if they exist
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- Recreate extensions in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule proactive token renewal every 30 minutes using extensions schema
SELECT extensions.cron.schedule(
  'proactive-token-renewal',
  '*/30 * * * *',
  $$
  SELECT
    extensions.net.http_post(
        url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/proactive-token-renewal',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2NDU2OSwiZXhwIjoyMDY3NzQwNTY5fQ.FrqzFS_hZQOwJTCW4TfBDbNbXJ8LjcN_pJ3QdLZ4yrI"}'::jsonb,
        body:='{"triggered_by": "cron_job"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule orphaned webhook processing every hour
SELECT extensions.cron.schedule(
  'process-orphaned-webhooks',
  '0 * * * *',
  $$
  SELECT
    extensions.net.http_post(
        url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/process-orphaned-webhooks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2NDU2OSwiZXhwIjoyMDY3NzQwNTY5fQ.FrqzFS_hZQOwJTCW4TfBDbNbXJ8LjcN_pJ3QdLZ4yrI"}'::jsonb,
        body:='{"triggered_by": "cron_job"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule token health monitoring every 6 hours
SELECT extensions.cron.schedule(
  'garmin-token-health-monitor',
  '0 */6 * * *',
  $$
  SELECT
    extensions.net.http_post(
        url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/garmin-token-health-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2NDU2OSwiZXhwIjoyMDY3NzQwNTY5fQ.FrqzFS_hZQOwJTCW4TfBDbNbXJ8LjcN_pJ3QdLZ4yrI"}'::jsonb,
        body:='{"triggered_by": "cron_job"}'::jsonb
    ) as request_id;
  $$
);

-- Update cron job status function to use extensions schema
CREATE OR REPLACE FUNCTION get_cron_job_status()
RETURNS TABLE(
  jobname text,
  schedule text,
  active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    jobname,
    schedule,
    active
  FROM extensions.cron.job
  WHERE jobname IN ('proactive-token-renewal', 'process-orphaned-webhooks', 'garmin-token-health-monitor');
$$;

-- Update force renewal function to use extensions schema
CREATE OR REPLACE FUNCTION force_renew_expired_tokens()
RETURNS TABLE(user_id uuid, status text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  token_record RECORD;
  renewal_result jsonb;
BEGIN
  -- Find all expired tokens with valid refresh tokens
  FOR token_record IN 
    SELECT gt.user_id, gt.garmin_user_id, gt.refresh_token, gt.expires_at, gt.refresh_token_expires_at
    FROM public.garmin_tokens gt
    WHERE gt.is_active = true
      AND gt.expires_at < NOW()
      AND gt.refresh_token IS NOT NULL
      AND (gt.refresh_token_expires_at IS NULL OR gt.refresh_token_expires_at > NOW())
  LOOP
    BEGIN
      -- Log the renewal attempt
      RAISE NOTICE 'Force renewing token for user % with garmin_user_id %', 
        token_record.user_id, token_record.garmin_user_id;
      
      -- Call the renewal function via HTTP
      SELECT extensions.net.http_post(
        url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/garmin-oauth',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE2NDU2OSwiZXhwIjoyMDY3NzQwNTY5fQ.FrqzFS_hZQOwJTCW4TfBDbNbXJ8LjcN_pJ3QdLZ4yrI"}'::jsonb,
        body := json_build_object(
          'refresh_token', token_record.refresh_token,
          'grant_type', 'refresh_token',
          'force_renewal', true
        )::jsonb
      ) INTO renewal_result;
      
      RETURN QUERY SELECT token_record.user_id, 'success'::text, 'Token renewal initiated'::text;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to renew token for user %: %', token_record.user_id, SQLERRM;
      RETURN QUERY SELECT token_record.user_id, 'error'::text, SQLERRM::text;
    END;
  END LOOP;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'info'::text, 'No expired tokens with valid refresh tokens found'::text;
  END IF;
END;
$$;