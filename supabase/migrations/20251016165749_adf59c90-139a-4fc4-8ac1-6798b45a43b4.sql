
-- Função que notifica o N8N quando um novo usuário é criado com telefone
CREATE OR REPLACE FUNCTION public.notify_n8n_on_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Só notifica se o telefone foi preenchido
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Chama o edge function notify-n8n-new-user (fire and forget)
    PERFORM net.http_post(
      url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/notify-n8n-new-user',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'name', NEW.display_name,
        'phone', NEW.phone
      )
    );
    
    RAISE NOTICE 'N8N notification triggered for user: % with phone: %', NEW.user_id, NEW.phone;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que dispara APÓS inserção de novo usuário na tabela profiles
CREATE TRIGGER trigger_notify_n8n_new_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_n8n_on_new_user();

COMMENT ON FUNCTION public.notify_n8n_on_new_user() IS 'Notifica N8N quando novo usuário é criado com telefone preenchido';
COMMENT ON TRIGGER trigger_notify_n8n_new_user ON public.profiles IS 'Dispara notificação N8N para novos usuários';
