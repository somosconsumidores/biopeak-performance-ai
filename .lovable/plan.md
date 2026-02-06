
# Plano: Treinos Ad-hoc no AI Coach (Sem Plano Ativo)

## Problema Identificado
A tool `create_scientific_workout` (linha 156-241 do `ai-coach-chat/index.ts`) atualmente:
1. Verifica se existe um plano ativo (`status = 'active'`)
2. Se não existir, retorna erro: `{ success: false, error: 'Sem plano ativo' }`
3. Isso impede atletas sem plano de treino de receberem treinos avulsos

## Solução Proposta
Criar um **plano ad-hoc** automaticamente quando:
- O atleta solicita um treino via chat
- Não possui nenhum plano ativo
- O plano ad-hoc será transparente para o usuário

## Arquitetura

### Fluxo de Dados
```text
Atleta pede treino → AI Coach → create_scientific_workout
                                        ↓
                               ┌───────────────────────────┐
                               │ Tem plano ativo?          │
                               ├─────────────┬─────────────┤
                               │ SIM         │ NÃO         │
                               │ Usa plano   │ Cria plano  │
                               │ existente   │ ad-hoc      │
                               └─────────────┴─────────────┘
                                        ↓
                                 Insere treino no plano
```

## Implementação

### 1. Modificação da Tool `create_scientific_workout`

**Lógica atual (problemática):**
```typescript
const { data: plan } = await sb.from('training_plans')
  .select('id')
  .eq('user_id', uid)
  .eq('status', 'active')
  .maybeSingle();

if (!plan) return { success: false, error: 'Sem plano ativo' };
```

**Nova lógica (com fallback para ad-hoc):**
```typescript
// 1. Tentar buscar plano ativo existente
let { data: plan } = await sb.from('training_plans')
  .select('id')
  .eq('user_id', uid)
  .eq('status', 'active')
  .maybeSingle();

// 2. Se não existe, criar plano ad-hoc automático
if (!plan) {
  const today = new Date().toISOString().split('T')[0];
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 90); // 90 dias de validade
  
  const { data: newPlan, error: createError } = await sb
    .from('training_plans')
    .insert({
      user_id: uid,
      plan_name: 'Treinos Avulsos',
      goal_type: 'fitness', // Objetivo genérico
      sport_type: 'running',
      start_date: today,
      end_date: endDate.toISOString().split('T')[0],
      weeks: 12,
      status: 'active'
    })
    .select('id')
    .single();
    
  if (createError) {
    return { success: false, error: 'Falha ao criar plano para treino avulso' };
  }
  
  plan = newPlan;
}

// 3. Continuar com criação do treino normalmente
```

### 2. Características do Plano Ad-hoc

| Campo | Valor | Justificativa |
|-------|-------|---------------|
| plan_name | "Treinos Avulsos" | Identificação clara |
| goal_type | "fitness" | Objetivo genérico/manutenção |
| sport_type | "running" | Padrão (pode ser inferido do treino) |
| weeks | 12 | ~90 dias de validade |
| status | "active" | Para permitir inserção de treinos |

### 3. Reutilização do Plano Ad-hoc
Se o atleta já tiver um plano ad-hoc ativo:
- O sistema usa o existente
- Não cria novos planos desnecessários
- Mantém todos os treinos avulsos agrupados

### 4. Identificação de Plano Ad-hoc
Para distinguir planos ad-hoc de planos completos, podemos:
- Verificar `goal_type = 'fitness'` + `plan_name = 'Treinos Avulsos'`
- Ou adicionar flag `is_adhoc` (opção alternativa)

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-coach-chat/index.ts` | Modificar tool `create_scientific_workout` com fallback ad-hoc |

## Considerações de UX

### Para o Atleta
- **Transparente**: Não precisa saber que um "plano" foi criado
- **Sem fricção**: Pede treino → recebe treino
- **Histórico preservado**: Treinos ficam salvos e visíveis no calendário

### Para o Sistema
- **Sem quebra de lógica**: Mantém relacionamento workout → plan
- **Minimal changes**: Apenas 1 arquivo modificado
- **RLS funciona**: Políticas existentes já cobrem o cenário

## Comportamento Esperado

### Cenário 1: Atleta sem plano pede treino
```
Atleta: "Cria um treino de intervalado para amanhã"
Coach: (cria plano ad-hoc silenciosamente)
Coach: "Criei seu treino de VO2max para amanhã! 🏃‍♂️ [detalhes]"
```

### Cenário 2: Atleta com plano ad-hoc pede mais treinos
```
Atleta: "Cria um longão para domingo"
Coach: (usa plano ad-hoc existente)
Coach: "Adicionei um longão de 18km no domingo! [detalhes]"
```

### Cenário 3: Atleta cria plano completo depois
- O plano ad-hoc continua existindo (não interfere)
- Novos treinos via coach usarão o plano completo (prioridade por data de criação mais recente ou sport_type match)

## Detalhes Técnicos

### Ordem de Prioridade para Selecionar Plano
1. Buscar plano ativo que não seja ad-hoc primeiro
2. Se não encontrar, buscar plano ad-hoc existente
3. Se não encontrar nenhum, criar novo plano ad-hoc

```typescript
// Prioridade 1: Plano ativo "real" (não ad-hoc)
let { data: plan } = await sb.from('training_plans')
  .select('id')
  .eq('user_id', uid)
  .eq('status', 'active')
  .neq('goal_type', 'fitness') // Exclui ad-hoc
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

// Prioridade 2: Plano ad-hoc existente
if (!plan) {
  const { data: adhocPlan } = await sb.from('training_plans')
    .select('id')
    .eq('user_id', uid)
    .eq('status', 'active')
    .eq('goal_type', 'fitness')
    .eq('plan_name', 'Treinos Avulsos')
    .maybeSingle();
  
  plan = adhocPlan;
}

// Prioridade 3: Criar novo ad-hoc
if (!plan) {
  // ... código de criação
}
```

## Resultado Esperado
1. Atletas sem plano podem receber treinos via AI Coach
2. Treinos ficam salvos e aparecem no calendário
3. Nenhuma mudança necessária no frontend
4. Lógica existente do backend preservada
