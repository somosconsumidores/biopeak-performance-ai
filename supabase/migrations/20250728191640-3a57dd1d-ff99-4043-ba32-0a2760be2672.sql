-- Adicionar coluna signature_secret_key à tabela polar_tokens
ALTER TABLE public.polar_tokens 
ADD COLUMN signature_secret_key TEXT;