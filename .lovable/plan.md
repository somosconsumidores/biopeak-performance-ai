
## Correção de Políticas RLS: garmin_function_calls, garmin_health_reports e garmin_rate_limits

### Situação Atual (Vulnerabilidade)

As três tabelas possuem uma política única com `qual: true` para o role `public`, o que significa que **qualquer usuário autenticado pode ler e modificar dados de qualquer outro usuário**:

| Tabela | Política Atual | Problema |
|---|---|---|
| `garmin_function_calls` | `System can manage function calls` — ALL para `public` | Expõe `ip_address`, `user_id`, `error_message` de todos os usuários |
| `garmin_health_reports` | `System can manage health reports` — ALL para `public` | Expõe relatórios internos de saúde do sistema (total de usuários, suspeitos, etc.) |
| `garmin_rate_limits` | `System can manage rate limits` — ALL para `public` | Expõe tentativas de acesso de outros usuários; a segunda policy SELECT é correta mas ineficaz porque a primeira já sobrepõe |

### Quem usa essas tabelas?

Verificação no código confirma que **nenhuma edge function** referencia essas tabelas diretamente por nome — elas são usadas apenas via `service_role` em operações internas (webhooks do Garmin, rate limiting, logging). O frontend também não as acessa diretamente.

### Solução Proposta

**Padrão**: Remover as políticas permissivas (`qual: true`) e substituir por políticas restritas ao `service_role`, seguindo o mesmo padrão já adotado em outras tabelas do projeto (como `user_evolution_stats`, `marketing`, `whatsapp_buffer`).

#### garmin_function_calls
- Dropar: `System can manage function calls`
- Criar: `Service role can manage function calls` → `TO service_role` com `USING (true)` e `WITH CHECK (true)`
- Criar: `Users can view own function calls` → `FOR SELECT TO authenticated USING (auth.uid() = user_id)` (opcional, para auditoria do próprio usuário)

#### garmin_health_reports
- Dropar: `System can manage health reports`
- Criar: `Service role can manage health reports` → `TO service_role` com `USING (true)` e `WITH CHECK (true)`
- **Sem** policy para usuários autenticados — esta tabela contém dados agregados do sistema, não dados por usuário

#### garmin_rate_limits
- Dropar: `System can manage rate limits` (a problemática)
- Manter: `Users can view their own rate limits` → `FOR SELECT TO authenticated USING (auth.uid() = user_id)` (esta já está correta)
- Criar: `Service role can manage rate limits` → `TO service_role` com `USING (true)` e `WITH CHECK (true)`

### SQL da Migração

```sql
-- ============================================================
-- garmin_function_calls
-- ============================================================
DROP POLICY IF EXISTS "System can manage function calls" ON public.garmin_function_calls;

CREATE POLICY "Service role can manage function calls"
  ON public.garmin_function_calls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own function calls"
  ON public.garmin_function_calls
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- garmin_health_reports (sem user_id — apenas service_role)
-- ============================================================
DROP POLICY IF EXISTS "System can manage health reports" ON public.garmin_health_reports;

CREATE POLICY "Service role can manage health reports"
  ON public.garmin_health_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- garmin_rate_limits
-- ============================================================
DROP POLICY IF EXISTS "System can manage rate limits" ON public.garmin_rate_limits;

CREATE POLICY "Service role can manage rate limits"
  ON public.garmin_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- A policy "Users can view their own rate limits" já existe e está correta — não será alterada
```

### Impacto e Riscos

- **Zero impacto no frontend**: o app React não consulta essas tabelas diretamente
- **Zero impacto nas edge functions**: todas usam `SUPABASE_SERVICE_KEY` internamente, que ignora RLS por padrão
- **Resultado**: um usuário autenticado (como o teste com OpenClaw) não conseguirá mais fazer SELECT em dados de outros usuários nessas tabelas

### O que o usuário autenticado poderá fazer após a correção

| Tabela | Antes | Depois |
|---|---|---|
| `garmin_function_calls` | Ver logs de TODOS os usuários | Ver apenas os seus próprios logs |
| `garmin_health_reports` | Ver relatórios internos do sistema | Acesso negado (tabela interna) |
| `garmin_rate_limits` | Ver tentativas de TODOS os usuários | Ver apenas as suas próprias tentativas |
