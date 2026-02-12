
-- 1. Replace the trigger function to call webhook directly via pg_net
CREATE OR REPLACE FUNCTION public.trg_notify_n8n_new_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.subscribers 
    WHERE user_id = NEW.user_id AND subscribed = true
  ) THEN
    PERFORM net.http_post(
      url := 'https://biopeak-ai.app.n8n.cloud/webhook/new-training-activity',
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'activity_id', NEW.activity_id,
        'activity_type', NEW.activity_type,
        'timestamp', now(),
        'source', 'BioPeak Activity Trigger'
      ),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Drop the queue table (no longer needed)
DROP TABLE IF EXISTS public.n8n_activity_notification_queue;
