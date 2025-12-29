-- Função do trigger que notifica n8n para novas atividades de assinantes ativos
CREATE OR REPLACE FUNCTION public.trg_notify_n8n_new_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  is_active_subscriber boolean;
BEGIN
  -- Verifica se o usuário é assinante ativo
  SELECT EXISTS (
    SELECT 1 FROM public.subscribers 
    WHERE user_id = NEW.user_id 
      AND subscribed = true
  ) INTO is_active_subscriber;
  
  -- Se for assinante ativo, notifica o n8n
  IF is_active_subscriber THEN
    PERFORM net.http_post(
      url := 'https://biopeak-ai.app.n8n.cloud/webhook/feedback-activity',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('user_id', NEW.user_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remove trigger existente se houver
DROP TRIGGER IF EXISTS trg_notify_n8n_on_new_activity ON public.all_activities;

-- Cria o trigger na tabela all_activities
CREATE TRIGGER trg_notify_n8n_on_new_activity
  AFTER INSERT ON public.all_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_n8n_new_activity();