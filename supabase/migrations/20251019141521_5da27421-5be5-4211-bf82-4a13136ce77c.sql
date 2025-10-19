-- Criar tabela para pagamentos do Mercado Pago
CREATE TABLE public.mercadopago_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Dados do Mercado Pago
  payment_id text,
  preference_id text,
  status text NOT NULL,
  
  -- Dados do plano
  plan_type text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  
  -- Metadados
  payment_method text,
  payment_type_id text,
  payer_email text,
  
  -- Timestamps
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.mercadopago_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own MP payments"
  ON public.mercadopago_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MP payments"
  ON public.mercadopago_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all MP payments"
  ON public.mercadopago_payments FOR ALL
  USING (auth.role() = 'service_role');