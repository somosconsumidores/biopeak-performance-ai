-- Criar tabela para fila de notificações N8N
CREATE TABLE IF NOT EXISTS public.n8n_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT,
  phone TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Habilitar RLS
ALTER TABLE public.n8n_notification_queue ENABLE ROW LEVEL SECURITY;

-- Policy para service role gerenciar
CREATE POLICY "Service role can manage queue"
  ON public.n8n_notification_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- Atualizar a função do trigger para usar a fila
CREATE OR REPLACE FUNCTION public.notify_n8n_on_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Só adiciona na fila se o usuário tem telefone
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    INSERT INTO public.n8n_notification_queue (user_id, name, phone)
    VALUES (NEW.user_id, NEW.display_name, NEW.phone);
  END IF;
  
  RETURN NEW;
END;
$$;