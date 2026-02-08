-- Drop and recreate the trigger function with the new webhook URL
CREATE OR REPLACE FUNCTION public.trg_notify_n8n_new_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only notify for subscribers
  IF EXISTS (
    SELECT 1 FROM public.subscribers 
    WHERE user_id = NEW.user_id AND subscribed = true
  ) THEN
    PERFORM net.http_post(
      url := 'https://biopeak-ai.app.n8n.cloud/webhook/new-training-from-subscriber',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('user_id', NEW.user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;