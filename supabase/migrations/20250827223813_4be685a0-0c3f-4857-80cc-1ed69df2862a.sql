
-- 1) Adiciona a coluna para armazenar o parecer de IA
ALTER TABLE public.race_progress_snapshots
ADD COLUMN IF NOT EXISTS ai_analysis text;

-- Observação:
-- - Mantemos a coluna como NULLable para que snapshots antigos continuem válidos.
-- - A função usa este campo para cache; se preenchido e recente (<= 7 dias), a resposta é reutilizada.
