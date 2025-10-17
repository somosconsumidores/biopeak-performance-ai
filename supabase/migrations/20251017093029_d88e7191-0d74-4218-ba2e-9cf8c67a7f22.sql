-- Habilitar Supabase Realtime na tabela strava_tokens
-- Necessário para o app nativo detectar quando tokens são salvos

-- Configurar REPLICA IDENTITY para capturar dados completos em updates
ALTER TABLE public.strava_tokens REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.strava_tokens;