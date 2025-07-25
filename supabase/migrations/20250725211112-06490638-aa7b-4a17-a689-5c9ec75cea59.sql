-- Função para reprocessar webhooks travados
CREATE OR REPLACE FUNCTION public.cleanup_stuck_webhooks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Update all stuck webhooks (processing for more than 10 minutes) to failed
  UPDATE garmin_webhook_logs 
  SET status = 'timeout_failed',
      error_message = 'Webhook timeout - reprocessed automatically'
  WHERE status = 'processing' 
    AND created_at < NOW() - INTERVAL '10 minutes';
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up stuck webhooks at %', NOW();
END;
$function$;

-- Execute the cleanup
SELECT public.cleanup_stuck_webhooks();