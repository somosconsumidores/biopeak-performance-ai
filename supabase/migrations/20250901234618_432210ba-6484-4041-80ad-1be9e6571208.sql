-- Add column to track if subscriber welcome email was sent
ALTER TABLE public.subscribers
ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

-- Trigger function to call Edge Function when a subscription becomes active
CREATE OR REPLACE FUNCTION public.trg_send_subscriber_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Fire on initial activation only (avoid duplicates)
  IF (
    TG_OP = 'INSERT' AND NEW.subscribed = true AND NEW.welcome_email_sent_at IS NULL
  ) OR (
    TG_OP = 'UPDATE' AND NEW.subscribed = true AND (OLD.subscribed IS DISTINCT FROM NEW.subscribed) AND NEW.welcome_email_sent_at IS NULL
  ) THEN

    -- Call the Edge Function (JWT verified with anon key like other triggers in this project)
    PERFORM net.http_post(
      url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/subscriber-welcome-email',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'email', NEW.email,
        'subscription_tier', NEW.subscription_tier,
        'subscription_end', NEW.subscription_end
      )
    );

    NEW.welcome_email_sent_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on subscribers
DROP TRIGGER IF EXISTS send_subscriber_welcome_email ON public.subscribers;
CREATE TRIGGER send_subscriber_welcome_email
BEFORE INSERT OR UPDATE ON public.subscribers
FOR EACH ROW
EXECUTE FUNCTION public.trg_send_subscriber_welcome_email();