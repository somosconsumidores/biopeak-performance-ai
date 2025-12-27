-- RPC para buscar payload grande com timeout maior
CREATE OR REPLACE FUNCTION public.get_garmin_webhook_log_payload(p_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- sobrescreve o statement_timeout da sessão (PostgREST costuma impor um menor)
  PERFORM set_config('statement_timeout', '60000', true);

  RETURN (
    SELECT payload::jsonb
    FROM public.garmin_webhook_logs
    WHERE id = p_log_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_garmin_webhook_log_payload(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_garmin_webhook_log_payload(uuid) TO service_role;
