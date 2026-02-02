
# Plano: Filtrar Segmentação Apenas para Assinantes Ativos

## Problema Atual

A Edge Function `compute-athlete-segmentation` está processando **todos os usuários** que possuem atividades, independente do status de assinatura. Isso causa:
- Processamento desnecessário de usuários não pagantes
- Erros de foreign key para usuários que não existem mais
- Desperdício de chamadas à API da OpenAI

## Solução

Utilizar o RPC existente `active_users_with_activities` que já faz o filtro correto:

```sql
-- Lógica do RPC existente:
SELECT DISTINCT a.user_id 
FROM all_activities a
JOIN subscribers s ON s.user_id = a.user_id
WHERE s.subscribed = true 
  AND a.activity_date BETWEEN p_start AND p_end
```

## Modificação Necessária

### Arquivo: `supabase/functions/compute-athlete-segmentation/index.ts`

**Antes (linhas 224-243):**
```typescript
// Busca TODOS os usuários com atividades
const { data: activeUsers, error: usersError } = await supabase
  .from("all_activities")
  .select("user_id")
  .gte("activity_date", eightWeeksAgo.toISOString().split("T")[0])
  .not("user_id", "is", null);
```

**Depois:**
```typescript
// Busca apenas ASSINANTES ATIVOS com atividades
const { data: usersData, error: usersError } = await supabase
  .rpc('active_users_with_activities', { 
    p_start: eightWeeksAgo.toISOString().split("T")[0], 
    p_end: today 
  });

if (usersError) {
  console.error("Error fetching active subscribers:", usersError);
  throw usersError;
}

const uniqueUserIds = (usersData ?? []).map((r: { user_id: string }) => r.user_id);
console.log(`[compute-athlete-segmentation] Found ${uniqueUserIds.length} active subscribers`);
```

## Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Usuários processados | ~21+ (todos com atividades) | ~15 (apenas assinantes) |
| Erros de FK | 3 usuários inexistentes | 0 (filtrados pelo JOIN) |
| Chamadas OpenAI | ~21 | ~15 (economia de 30%) |
| Tempo execução | ~156s | ~100s (estimado) |

## Segurança Adicional

A função `active_users_with_activities` faz `JOIN` com a tabela `subscribers`, o que automaticamente:
1. Valida que o `user_id` existe na tabela de assinantes
2. Confirma que `subscribed = true`
3. Evita erros de foreign key na inserção

## Implementação

Modificação de apenas 1 arquivo:
- `supabase/functions/compute-athlete-segmentation/index.ts`

Tempo estimado: 5 minutos
