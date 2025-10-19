-- Atualizar função notify_phone_update com correções
DROP FUNCTION IF EXISTS public.notify_phone_update() CASCADE;

CREATE FUNCTION public.notify_phone_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id bigint;
BEGIN
  RAISE NOTICE 'Phone updated for user %: % -> %', NEW.id, OLD.phone, NEW.phone;
  
  SELECT extensions.http_post(
    url := 'https://biopeak-ai.app.n8n.cloud/webhook/new-user-whatsapp',
    body := jsonb_build_object(
      'user_id', NEW.id::text,
      'display_name', NEW.display_name,
      'old_phone', OLD.phone,
      'new_phone', NEW.phone
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  ) INTO request_id;
  
  RAISE NOTICE 'Webhook queued: %', request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Webhook error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recriar trigger
CREATE TRIGGER on_phone_update_trigger
  AFTER UPDATE OF phone ON public.profiles
  FOR EACH ROW
  WHEN (OLD.phone IS DISTINCT FROM NEW.phone)
  EXECUTE FUNCTION public.notify_phone_update();