-- 1. Criar tabela de fila para notificações de atividades
CREATE TABLE public.n8n_activity_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id TEXT,
  activity_type TEXT,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

-- 2. Habilitar RLS
ALTER TABLE public.n8n_activity_notification_queue 
  ENABLE ROW LEVEL SECURITY;

-- 3. Policy para service_role
CREATE POLICY "Service role can manage activity queue"
  ON public.n8n_activity_notification_queue
  FOR ALL USING (auth.role() = 'service_role');

-- 4. Index para buscar pendentes rapidamente
CREATE INDEX idx_activity_queue_pending 
  ON public.n8n_activity_notification_queue(status) 
  WHERE status = 'pending';

-- 5. Modificar trigger para usar fila ao invés de HTTP direto
CREATE OR REPLACE FUNCTION public.trg_notify_n8n_new_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Só adiciona na fila para assinantes ativos
  IF EXISTS (
    SELECT 1 FROM public.subscribers 
    WHERE user_id = NEW.user_id AND subscribed = true
  ) THEN
    INSERT INTO public.n8n_activity_notification_queue 
      (user_id, activity_id, activity_type)
    VALUES 
      (NEW.user_id, NEW.activity_id, NEW.activity_type);
  END IF;
  RETURN NEW;
END;
$$;