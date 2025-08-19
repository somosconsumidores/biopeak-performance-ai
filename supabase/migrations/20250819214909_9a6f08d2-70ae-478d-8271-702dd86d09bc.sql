
-- Adiciona a coluna utm_source à tabela de perfis
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS utm_source text;

-- (Opcional, mas útil para documentação)
COMMENT ON COLUMN public.profiles.utm_source IS 'UTM source (primeiro toque) capturado no signup, ex: post_instagram';
