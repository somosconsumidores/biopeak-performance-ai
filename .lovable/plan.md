
# Plano: Corrigir Vulnerabilidade de Segurança em `whatsapp_buffer`

## Contexto do Problema

### Situação Atual
A tabela `whatsapp_buffer` armazena mensagens de WhatsApp pendentes de processamento. Contém **dados pessoais sensíveis** (números de telefone e conteúdo de mensagens) mas está **completamente exposta** via API.

### Dados na Tabela

| Métrica | Valor |
|---------|-------|
| Total de registros | 238 |
| Última entrada | 2026-01-23 |
| Status RLS | ❌ Desabilitado |
| Políticas RLS | Nenhuma |

### Colunas Sensíveis

| Coluna | Tipo | Sensibilidade |
|--------|------|---------------|
| `phone` | text | 🔴 Alta - Número de telefone pessoal |
| `message_content` | text | 🔴 Alta - Conteúdo de conversas |
| `processed` | boolean | 🟡 Média - Estado de processamento |
| `created_at` | timestamp | 🟢 Baixa |

### O Problema Técnico

```text
┌──────────────────────────────────────────────────────────────┐
│  Qualquer pessoa com a chave anon pode:                      │
├──────────────────────────────────────────────────────────────┤
│  1. GET /rest/v1/whatsapp_buffer                             │
│     → Lê TODOS os telefones e mensagens                      │
│                                                              │
│  2. POST /rest/v1/whatsapp_buffer                            │
│     → Injeta mensagens falsas no sistema                     │
│                                                              │
│  3. PATCH/DELETE /rest/v1/whatsapp_buffer                    │
│     → Modifica ou apaga mensagens legítimas                  │
└──────────────────────────────────────────────────────────────┘
```

### Riscos

| Risco | Severidade | Descrição |
|-------|------------|-----------|
| Vazamento de dados | 🔴 Crítico | Telefones e mensagens expostos publicamente |
| Injeção de dados | 🔴 Crítico | Atacante pode inserir mensagens maliciosas |
| Manipulação | 🟠 Alto | Atacante pode marcar mensagens como processadas |
| Compliance | 🔴 Crítico | Violação potencial de LGPD/GDPR |

---

## Análise de Uso

### Quem Acessa Esta Tabela?

| Componente | Encontrado | Observação |
|------------|------------|------------|
| Frontend (`src/`) | ❌ Não | Apenas tipos gerados automaticamente |
| Edge Functions | ❌ Não | Nenhuma referência encontrada |
| Webhooks externos (n8n) | ⚠️ Provável | Padrão comum para integração WhatsApp |

### Conclusão
A tabela parece ser usada **exclusivamente por sistemas backend** (provavelmente n8n ou webhooks externos) para buffer de mensagens WhatsApp. O frontend **não acessa** esta tabela diretamente.

---

## Solução Proposta

### Opção Recomendada: RLS + Acesso Restrito a `service_role`

Esta abordagem:
- ✅ Mantém a tabela funcional para Edge Functions e webhooks com `service_role`
- ✅ Bloqueia completamente acesso via `anon` e `authenticated`
- ✅ Não requer mudanças em integrações externas que usam `service_role`

### Passo 1: Habilitar RLS

```sql
ALTER TABLE public.whatsapp_buffer ENABLE ROW LEVEL SECURITY;
```

### Passo 2: Criar Política Restritiva

```sql
-- Apenas service_role pode acessar (usado por Edge Functions e webhooks)
CREATE POLICY "Service role only access"
ON public.whatsapp_buffer
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### Passo 3: Garantir Bloqueio para Outras Roles

Com RLS habilitado e apenas a política para `service_role`, as roles `anon` e `authenticated` serão automaticamente bloqueadas (comportamento padrão do RLS).

---

## Alternativas Consideradas

### Alternativa A: Mover para Schema Privado

```sql
-- Criar schema não exposto ao PostgREST
CREATE SCHEMA IF NOT EXISTS private;

-- Mover tabela
ALTER TABLE public.whatsapp_buffer SET SCHEMA private;
```

**Prós:** Tabela invisível na API  
**Contras:** Requer atualizar todas as referências para `private.whatsapp_buffer`

### Alternativa B: Revogar Permissões Diretamente

```sql
REVOKE ALL ON public.whatsapp_buffer FROM anon, authenticated;
GRANT ALL ON public.whatsapp_buffer TO service_role;
```

**Prós:** Simples  
**Contras:** Menos granular que RLS, pode ser sobrescrito

### Alternativa C: Dropar Tabela (se não estiver em uso)

```sql
DROP TABLE public.whatsapp_buffer;
```

**Prós:** Elimina risco completamente  
**Contras:** Só viável se tabela não for mais necessária

---

## Validação Pós-Correção

### Teste 1: Verificar que `anon` NÃO pode ler dados

```bash
curl -X GET \
  'https://grcwlmltlcltmwbhdpky.supabase.co/rest/v1/whatsapp_buffer?select=*' \
  -H 'apikey: <ANON_KEY>' \
  -H 'Authorization: Bearer <ANON_KEY>'

# Esperado: [] (array vazio) ou erro 403
```

### Teste 2: Verificar que `service_role` PODE acessar

```sql
-- Via SQL Editor com service_role
SELECT COUNT(*) FROM whatsapp_buffer;
-- Esperado: 238 (ou total atual)
```

### Teste 3: Verificar integrações externas

1. Enviar mensagem de teste via WhatsApp
2. Verificar se webhook/n8n consegue inserir no buffer
3. Verificar se processamento continua funcionando

---

## SQL Completo da Migração

```sql
-- =============================================================
-- CORREÇÃO DE SEGURANÇA: whatsapp_buffer
-- Problema: Tabela com dados sensíveis (telefones, mensagens)
--           exposta publicamente sem RLS
-- Solução: Habilitar RLS e restringir acesso a service_role
-- =============================================================

-- Passo 1: Habilitar Row Level Security
ALTER TABLE public.whatsapp_buffer ENABLE ROW LEVEL SECURITY;

-- Passo 2: Criar política restrita a service_role
-- (webhooks e Edge Functions usam service_role)
CREATE POLICY "Service role only access"
ON public.whatsapp_buffer
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verificação: Confirmar que RLS está ativo
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'whatsapp_buffer';

-- Verificação: Listar políticas
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'whatsapp_buffer';
```

---

## Resultado Esperado

### Antes

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| `anon` | ✅ Todos | ✅ | ✅ | ✅ |
| `authenticated` | ✅ Todos | ✅ | ✅ | ✅ |
| `service_role` | ✅ Todos | ✅ | ✅ | ✅ |

### Depois

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| `anon` | ❌ | ❌ | ❌ | ❌ |
| `authenticated` | ❌ | ❌ | ❌ | ❌ |
| `service_role` | ✅ Todos | ✅ | ✅ | ✅ |

---

## Impacto

| Componente | Impacto |
|------------|---------|
| Frontend | ✅ Nenhum (não usa esta tabela) |
| Edge Functions | ✅ Nenhum (usam `service_role`) |
| Webhooks (n8n) | ✅ Nenhum (devem usar `service_role`) |
| API pública | ✅ **Bloqueada** (objetivo da correção) |

---

## Checklist de Implementação

- [ ] Executar migração SQL
- [ ] Verificar RLS habilitado via `pg_tables`
- [ ] Verificar política criada via `pg_policies`
- [ ] Testar acesso com `anon` (deve falhar)
- [ ] Testar acesso com `service_role` (deve funcionar)
- [ ] Verificar integrações WhatsApp continuam funcionando
