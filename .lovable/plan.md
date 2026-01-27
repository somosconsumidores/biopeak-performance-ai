

# Plano: Corrigir Política RLS Vulnerável em `user_evolution_stats`

## Contexto do Problema

### Situação Atual
A tabela `user_evolution_stats` armazena estatísticas de evolução pré-calculadas para cada atleta. A tabela tem RLS habilitado, mas contém uma **falha crítica de segurança** na política de escrita.

### Políticas Atuais

| Política | Comando | Condição |
|----------|---------|----------|
| `Users can read own evolution stats` | SELECT | `auth.uid() = user_id` |
| `Service can manage evolution stats` | ALL | `USING (true)` |

### O Problema Técnico
A política `"Service can manage evolution stats"` foi criada com a intenção de permitir que apenas a Edge Function (usando `service_role`) pudesse inserir/atualizar dados. **Porém, a política não especifica `TO service_role`**, o que significa que ela se aplica a **todas as roles**, incluindo `authenticated`.

### Fluxo de Ataque Possível
```text
┌──────────────────────────────────────────────────────────────┐
│  Usuário malicioso autenticado                               │
├──────────────────────────────────────────────────────────────┤
│  1. Obtém JWT válido (login normal no app)                   │
│  2. Usa Supabase client ou API direta                        │
│  3. Executa: UPDATE user_evolution_stats                     │
│              SET stats_data = '{"fake": true}'               │
│              WHERE user_id = 'outro-atleta-uuid'             │
│  4. Política "Service can manage..." permite (USING true)   │
│  5. Dados de outro atleta são corrompidos                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Análise de Impacto

### Quem Acessa Esta Tabela?

| Componente | Operação | Role Usada |
|------------|----------|------------|
| `useEvolutionStats.ts` (frontend) | SELECT | `authenticated` (via JWT do usuário) |
| `calculate-evolution-stats` (Edge Function) | UPSERT | `service_role` |
| `analyze-evolution-stats` (Edge Function) | SELECT | `service_role` |

### Impacto da Correção

**Nenhum impacto negativo para o usuário final:**

1. **Frontend (SELECT)**: Continuará funcionando normalmente
   - A policy `"Users can read own evolution stats"` já restringe corretamente por `auth.uid() = user_id`
   
2. **Edge Functions (UPSERT/SELECT)**: Continuarão funcionando
   - Ambas usam `SUPABASE_SERVICE_ROLE_KEY` para criar o client
   - A nova policy explícita para `service_role` permitirá as operações

---

## Solução Proposta

### Passo 1: Remover Política Vulnerável

```sql
DROP POLICY "Service can manage evolution stats" ON public.user_evolution_stats;
```

### Passo 2: Criar Nova Política Segura

```sql
CREATE POLICY "Service role can manage evolution stats"
ON public.user_evolution_stats
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### Diferença Crítica

| Antes | Depois |
|-------|--------|
| `FOR ALL` (sem TO) | `FOR ALL TO service_role` |
| Aplica-se a TODAS as roles | Aplica-se APENAS a `service_role` |

---

## Validação Pós-Correção

### Teste 1: Verificar que usuários autenticados NÃO podem modificar dados de outros

```sql
-- Simular usuário autenticado tentando UPDATE em dados de outro
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "user-a-uuid"}';

UPDATE user_evolution_stats 
SET stats_data = '{"hack": true}' 
WHERE user_id = 'user-b-uuid';

-- Esperado: 0 rows affected (política bloqueia)
```

### Teste 2: Verificar que Edge Functions continuam funcionando

1. Acessar página de Evolução no app
2. Clicar em "Atualizar"
3. Verificar que stats são calculadas e salvas corretamente
4. Verificar logs da Edge Function `calculate-evolution-stats`

### Teste 3: Verificar que SELECT próprio continua funcionando

1. Acessar página de Evolução
2. Verificar que gráficos carregam normalmente
3. Verificar console para erros de permissão

---

## Resumo das Alterações

| Ação | Arquivo/Recurso | Descrição |
|------|-----------------|-----------|
| DROP | RLS Policy | Remove `"Service can manage evolution stats"` |
| CREATE | RLS Policy | Cria `"Service role can manage evolution stats"` com `TO service_role` |

---

## Seção Técnica: SQL Completo da Migração

```sql
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

-- Verificação: Listar políticas após correção
-- SELECT policyname, cmd, roles, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'user_evolution_stats';
```

---

## Resultado Esperado

Após a correção:

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| `anon` | ❌ | ❌ | ❌ | ❌ |
| `authenticated` | ✅ (próprio) | ❌ | ❌ | ❌ |
| `service_role` | ✅ (todos) | ✅ | ✅ | ✅ |

