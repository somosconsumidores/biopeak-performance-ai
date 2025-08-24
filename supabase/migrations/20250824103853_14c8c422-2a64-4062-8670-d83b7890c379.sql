
-- 1) Desabilitar imediatamente o trigger na tabela garmin_activity_details
DROP TRIGGER IF EXISTS after_insert_process_activity_chart_from_details ON public.garmin_activity_details;

-- Opcional: manter a função criada para esse trigger (sem efeito). 
-- Se quiser remover também a função, descomente a linha abaixo:
-- DROP FUNCTION IF EXISTS public.trg_process_activity_chart_from_details();

-- 2) Restringir a função do trigger em garmin_webhook_logs
CREATE OR REPLACE FUNCTION public.trg_process_activity_chart_from_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Dispara APENAS para notificações de detalhes de atividade (valor exato)
  IF NEW.webhook_type IS NULL OR lower(NEW.webhook_type) <> 'activity_details_notification' THEN
    RETURN NEW;
  END IF;

  -- Chamada fire-and-forget para a Edge Function
  PERFORM net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/process-activity-chart-from-garmin-log',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('webhook_log_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- 3) Garantir que só exista o trigger certo em garmin_webhook_logs
DROP TRIGGER IF EXISTS after_insert_process_activity_chart_from_log ON public.garmin_webhook_logs;

CREATE TRIGGER after_insert_process_activity_chart_from_log
AFTER INSERT ON public.garmin_webhook_logs
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_activity_chart_from_log();
