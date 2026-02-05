
# Plano: Adicionar Tool de Cancelamento de Planos ao AI Coach

## Resumo

O AI Coach precisa de autonomia para cancelar planos de treino quando o usuário solicitar. Isso inclui planos de corrida, ciclismo, natação e força. A implementação será feita adicionando uma nova tool `cancel_training_plan` na Edge Function.

## Contexto Técnico

### Estrutura Atual
- **Tabela `training_plans`**: Possui coluna `sport_type` (running, cycling, swimming, strength) e `status` (active, pending, cancelled)
- **Cancelamento existente**: A aplicação já usa `status: 'cancelled'` para soft-delete
- **Tool atual `get_training_plan`**: Busca apenas 1 plano ativo (`.maybeSingle()`) - precisa ser ajustado para multi-plano

## Mudanças a Implementar

### 1. Nova Tool: `cancel_training_plan`

```typescript
{ 
  type: "function", 
  function: { 
    name: "cancel_training_plan", 
    description: "Cancela plano de treino do usuário. Use quando atleta pedir para encerrar, pausar ou cancelar um plano.", 
    parameters: { 
      type: "object", 
      properties: { 
        sport_type: { 
          type: "string", 
          enum: ["running", "cycling", "swimming", "strength"],
          description: "Tipo do plano: running (corrida), cycling (ciclismo), swimming (natação), strength (força/musculação)" 
        },
        reason: {
          type: "string",
          description: "Motivo do cancelamento para registro"
        }
      }, 
      required: ["sport_type"],
      additionalProperties: false 
    } 
  } 
}
```

### 2. Executor da Tool

```typescript
if (name === "cancel_training_plan") {
  const sportType = args.sport_type?.toLowerCase();
  const validSports = ['running', 'cycling', 'swimming', 'strength'];
  
  if (!validSports.includes(sportType)) {
    return { success: false, error: 'Esporte inválido. Use: running, cycling, swimming ou strength' };
  }
  
  // Buscar plano ativo do esporte especificado
  const { data: plan, error: fetchError } = await sb
    .from('training_plans')
    .select('id, plan_name, sport_type, start_date, end_date')
    .eq('user_id', uid)
    .eq('sport_type', sportType)
    .eq('status', 'active')
    .maybeSingle();
  
  if (fetchError) return { success: false, error: 'Erro ao buscar plano' };
  if (!plan) return { success: false, error: `Nenhum plano de ${sportType} ativo encontrado` };
  
  // Cancelar o plano
  const { error: updateError } = await sb
    .from('training_plans')
    .update({ 
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', plan.id);
  
  if (updateError) return { success: false, error: 'Falha ao cancelar plano' };
  
  return { 
    success: true, 
    message: `Plano de ${sportType} "${plan.plan_name || 'Sem nome'}" cancelado com sucesso`,
    cancelled_plan: {
      id: plan.id,
      name: plan.plan_name,
      sport: plan.sport_type,
      start_date: plan.start_date,
      end_date: plan.end_date
    },
    reason: args.reason || 'Solicitado pelo atleta'
  };
}
```

### 3. Atualizar `get_training_plan` para Multi-Esporte

Modificar para retornar todos os planos ativos (não apenas 1):

```typescript
if (name === "get_training_plan") {
  // Buscar TODOS os planos ativos (multi-esporte)
  const { data: plans } = await sb
    .from('training_plans')
    .select('*')
    .eq('user_id', uid)
    .eq('status', 'active');
  
  if (!plans?.length) return { found: false, message: 'Nenhum plano ativo' };
  
  // Para cada plano, buscar próximos treinos
  const result = [];
  const today = new Date().toISOString().split('T')[0];
  
  for (const plan of plans) {
    const { data: workouts } = await sb
      .from('training_plan_workouts')
      .select('id, workout_date, title, workout_type, status')
      .eq('plan_id', plan.id)
      .gte('workout_date', today)
      .eq('status', 'planned')
      .order('workout_date')
      .limit(5);
    
    result.push({
      id: plan.id,
      name: plan.plan_name || plan.goal_type,
      sport: plan.sport_type,
      goal: plan.goal_type,
      start_date: plan.start_date,
      end_date: plan.end_date,
      upcoming_workouts: workouts?.map(w => ({
        date: w.workout_date,
        title: w.title,
        type: w.workout_type
      })) || []
    });
  }
  
  return { 
    found: true, 
    plans: result,
    total_active: result.length 
  };
}
```

### 4. Atualizar System Prompt

Adicionar a nova tool na documentação:

```typescript
TOOLS:
...
- cancel_training_plan: Cancela plano específico (running/cycling/swimming/strength)
...

REGRAS PARA CANCELAMENTO:
- SEMPRE confirme com o usuário antes de cancelar
- Pergunte o motivo para registro
- Após cancelar, sugira alternativas (novo plano, pausa temporária, etc)
```

## Fluxo de Uso Esperado

```text
Usuário: "Quero cancelar meu plano de corrida"

Coach: 
1. Chama get_training_plan → vê plano de corrida ativo
2. Confirma com usuário: "Você tem um plano de Maratona SP (12 semanas). Confirma cancelamento?"
3. Usuário confirma
4. Chama cancel_training_plan(sport_type: "running", reason: "...")
5. Responde: "Plano cancelado! Quer criar um novo plano ou fazer uma pausa?"
```

## Arquivo a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/ai-coach-chat/index.ts` | Nova tool, executor, prompt atualizado |

## Resultado Esperado

- AI Coach pode cancelar qualquer tipo de plano via chat
- Suporte a multi-esporte (running, cycling, swimming, strength)
- Confirmação antes de cancelar
- Registro do motivo para análise futura
