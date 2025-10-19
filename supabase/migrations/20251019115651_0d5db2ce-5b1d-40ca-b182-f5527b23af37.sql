-- Corrigir função notify_phone_update para usar net.http_post
DROP FUNCTION IF EXISTS public.notify_phone_update() CASCADE;

CREATE FUNCTION public.notify_phone_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  request_id bigint;
BEGIN
  RAISE NOTICE 'Phone updated for user %: % -> %', NEW.id, OLD.phone, NEW.phone;
  
  SELECT net.http_post(
    url := 'https://biopeak-ai.app.n8n.cloud/webhook-test/whatsapp-welcome-flow',
    body := jsonb_build_object(
      'user_id', NEW.id::text,
      'display_name', NEW.display_name,
      'old_phone', OLD.phone,
      'new_phone', NEW.phone
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  ) INTO request_id;
  
  RAISE NOTICE 'Webhook queued with ID: %', request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_phone_update_trigger ON public.profiles;

CREATE TRIGGER on_phone_update_trigger
  AFTER UPDATE OF phone ON public.profiles
  FOR EACH ROW
  WHEN (OLD.phone IS DISTINCT FROM NEW.phone)
  EXECUTE FUNCTION public.notify_phone_update();