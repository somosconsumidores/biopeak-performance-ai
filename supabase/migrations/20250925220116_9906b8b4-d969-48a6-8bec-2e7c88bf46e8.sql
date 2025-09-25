-- Criar tabela faturamento para registrar pagamentos dos usuários
CREATE TABLE public.faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_payment_id TEXT NOT NULL UNIQUE,
  tipo_pagamento TEXT NOT NULL CHECK (tipo_pagamento IN ('subscription', 'one_time')),
  valor_centavos INTEGER NOT NULL,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded', 'canceled')),
  descricao TEXT,
  data_pagamento TIMESTAMP WITH TIME ZONE NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_faturamento_user_id ON public.faturamento(user_id);
CREATE INDEX idx_faturamento_stripe_customer_id ON public.faturamento(stripe_customer_id);
CREATE INDEX idx_faturamento_data_pagamento ON public.faturamento(data_pagamento DESC);
CREATE INDEX idx_faturamento_status ON public.faturamento(status);
CREATE INDEX idx_faturamento_tipo_pagamento ON public.faturamento(tipo_pagamento);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_faturamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_faturamento_updated_at
  BEFORE UPDATE ON public.faturamento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_faturamento_updated_at();

-- Habilitar Row Level Security
ALTER TABLE public.faturamento ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Usuários podem ver apenas seus próprios registros de faturamento
CREATE POLICY "Users can view their own faturamento" 
ON public.faturamento 
FOR SELECT 
USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios registros de faturamento
CREATE POLICY "Users can insert their own faturamento" 
ON public.faturamento 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios registros de faturamento
CREATE POLICY "Users can update their own faturamento" 
ON public.faturamento 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Service role pode gerenciar todos os registros
CREATE POLICY "Service role can manage all faturamento" 
ON public.faturamento 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Admins podem ver todos os registros
CREATE POLICY "Admins can view all faturamento" 
ON public.faturamento 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));