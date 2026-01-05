-- Criar materialized view com tokens órfãos (usuários deletados)
CREATE MATERIALIZED VIEW mv_strava_orphan_tokens AS
SELECT 
  st.user_id,
  st.access_token
FROM strava_tokens st
LEFT JOIN auth.users u ON st.user_id = u.id
WHERE u.id IS NULL;

-- Criar índice para performance
CREATE UNIQUE INDEX idx_mv_strava_orphan_tokens_user_id 
ON mv_strava_orphan_tokens(user_id);

-- Criar função para refresh da view
CREATE OR REPLACE FUNCTION refresh_mv_strava_orphan_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_strava_orphan_tokens;
END;
$$;