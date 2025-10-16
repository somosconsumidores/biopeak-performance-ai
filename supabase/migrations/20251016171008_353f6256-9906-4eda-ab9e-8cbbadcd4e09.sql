-- Criar função PL/pgSQL que chama a edge function
CREATE OR REPLACE FUNCTION public.notify_n8n_on_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Só notifica se o usuário tem telefone
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Chama a edge function de forma assíncrona
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
  END IF;
  
  RETURN NEW;
END;
$$;