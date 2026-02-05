-- Atualiza a função do trigger para usar a nova URL do webhook
CREATE OR REPLACE FUNCTION public.trg_notify_n8n_new_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  is_active_subscriber boolean;
BEGIN
  -- Verifica se o usuário é assinante ativo (subscribed = true E subscription_end no futuro)
  SELECT EXISTS (
    SELECT 1 FROM public.subscribers 
    WHERE user_id = NEW.user_id 
      AND subscribed = true
      AND subscription_end > NOW()
  ) INTO is_active_subscriber;
  
  -- Se for assinante ativo, notifica o n8n
  IF is_active_subscriber THEN
    PERFORM net.http_post(
      url := 'https://biopeak-ai.app.n8n.cloud/webhook/subscriber-new-training',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('user_id', NEW.user_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;