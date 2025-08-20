
-- 1) Reativar o token mais recente do Polar user 62296023
WITH latest AS (
  SELECT id
  FROM public.polar_tokens
  WHERE x_user_id = 62296023
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1
)
UPDATE public.polar_tokens p
SET is_active = true,
    updated_at = now()
FROM latest
WHERE p.id = latest.id;

-- 2) (Opcional) Garantir que só o mais recente permaneça ativo
UPDATE public.polar_tokens
SET is_active = false,
    updated_at = now()
WHERE x_user_id = 62296023
  AND id <> (
    SELECT id
    FROM public.polar_tokens
    WHERE x_user_id = 62296023
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  );
