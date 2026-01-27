-- =============================================================
-- CORREÇÃO DE SEGURANÇA: user_evolution_stats
-- Problema: Política permissiva permitia UPDATE/DELETE por qualquer
--           usuário autenticado em dados de outros atletas
-- Solução: Restringir operações de escrita apenas para service_role
-- =============================================================

-- Passo 1: Remover política vulnerável
DROP POLICY IF EXISTS "Service can manage evolution stats" ON public.user_evolution_stats;

-- Passo 2: Criar política segura restrita a service_role
CREATE POLICY "Service role can manage evolution stats"
ON public.user_evolution_stats
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);