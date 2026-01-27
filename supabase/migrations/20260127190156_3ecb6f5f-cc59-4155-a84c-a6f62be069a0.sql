-- =============================================================
-- CORREÇÃO DE SEGURANÇA: whatsapp_buffer
-- Problema: Tabela com dados sensíveis (telefones, mensagens)
--           exposta publicamente sem RLS
-- Solução: Habilitar RLS e restringir acesso a service_role
-- =============================================================

-- Passo 1: Habilitar Row Level Security
ALTER TABLE public.whatsapp_buffer ENABLE ROW LEVEL SECURITY;

-- Passo 2: Criar política restrita a service_role
CREATE POLICY "Service role only access"
ON public.whatsapp_buffer
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);