

# Plano: Coach IA Autônomo com Tool Calling

## Problema Identificado

O Coach IA atual tem duas limitações críticas:

1. **Não usa os dados que já busca**: A função `fetchLastActivityDetails` busca todos os dados do último treino (pace, FC, distância, etc.), mas a IA pede ao usuário para informá-los manualmente
2. **Não pode executar ações**: O coach só responde perguntas, não pode reagendar treinos, criar workouts, ou modificar planos

## Solução: Sistema de Tool Calling

Implementar **Function Calling** no AI Coach, permitindo que o LLM:
- Busque dados específicos sob demanda
- Execute ações no sistema (CRUD de treinos, reagendamentos, análises)

```text
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITETURA PROPOSTA                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │   Frontend  │────▶│ ai-coach-chat│────▶│ Lovable AI  │  │
│  │  (Chat UI)  │◀────│ (Edge Func)  │◀────│  + Tools    │  │
│  └─────────────┘     └──────┬───────┘     └─────────────┘  │
│                             │                               │
│                             ▼                               │
│              ┌──────────────────────────────┐              │
│              │        TOOL EXECUTOR         │              │
│              ├──────────────────────────────┤              │
│              │ • get_last_activity          │              │
│              │ • get_activity_by_date       │              │
│              │ • analyze_training_load      │              │
│              │ • reschedule_workout         │              │
│              │ • create_workout             │              │
│              │ • get_training_plan          │              │
│              │ • compare_activities         │              │
│              │ • get_sleep_recovery         │              │
│              └──────────────────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Tools a Implementar

### Ferramentas de Leitura (Query)
| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `get_last_activity` | Busca detalhes completos da última atividade | `activity_type?` (RUNNING, CYCLING, etc) |
| `get_activity_by_date` | Busca atividade em data específica | `date`, `activity_type?` |
| `get_activities_range` | Lista atividades em período | `start_date`, `end_date`, `activity_type?` |
| `get_training_plan` | Retorna plano ativo com workouts | - |
| `get_sleep_data` | Dados de sono dos últimos N dias | `days` (default: 7) |
| `get_fitness_scores` | CTL, ATL, TSB atuais | - |
| `compare_activities` | Compara 2+ atividades | `activity_ids[]` ou `date_range` |

### Ferramentas de Ação (Mutation)
| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `reschedule_workout` | Move treino para nova data | `workout_id`, `new_date`, `strategy` |
| `create_custom_workout` | Cria treino personalizado | `date`, `type`, `description`, `target_pace?`, `duration?` |
| `mark_workout_complete` | Marca treino como concluído | `workout_id`, `notes?` |
| `skip_workout` | Pula treino com motivo | `workout_id`, `reason` |

## Mudanças Técnicas

### 1. Definição das Tools (Schema)

```typescript
const coachTools = [
  {
    type: "function",
    function: {
      name: "get_last_activity",
      description: "Busca detalhes completos da última atividade do atleta",
      parameters: {
        type: "object",
        properties: {
          activity_type: {
            type: "string",
            enum: ["RUNNING", "CYCLING", "SWIMMING", "STRENGTH"],
            description: "Tipo de atividade (opcional)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reschedule_workout",
      description: "Reagenda um treino para nova data",
      parameters: {
        type: "object",
        properties: {
          workout_id: { type: "string", description: "ID do treino" },
          new_date: { type: "string", description: "Nova data (YYYY-MM-DD)" },
          strategy: { 
            type: "string", 
            enum: ["swap", "replace", "push"],
            description: "Estratégia de conflito"
          }
        },
        required: ["workout_id", "new_date"]
      }
    }
  }
  // ... outras tools
];
```

### 2. Loop de Execução de Tools

```typescript
// Chamada inicial ao LLM com tools disponíveis
let response = await callAI(messages, coachTools);

// Loop enquanto LLM solicitar tools
while (response.choices[0].message.tool_calls) {
  const toolCalls = response.choices[0].message.tool_calls;
  const toolResults = [];
  
  for (const call of toolCalls) {
    const result = await executeToolCall(call.function.name, call.function.arguments);
    toolResults.push({
      tool_call_id: call.id,
      role: "tool",
      content: JSON.stringify(result)
    });
  }
  
  // Nova chamada com resultados das tools
  messages.push(response.choices[0].message);
  messages.push(...toolResults);
  response = await callAI(messages, coachTools);
}

// Resposta final ao usuário
return response.choices[0].message.content;
```

### 3. Executor de Tools

```typescript
async function executeToolCall(name: string, args: any, supabase: any, userId: string) {
  switch (name) {
    case 'get_last_activity':
      return await fetchLastActivityDetails(userId, supabase, null, args.activity_type);
    
    case 'reschedule_workout':
      // Chama a Edge Function existente internamente
      return await rescheduleWorkout(userId, args.workout_id, args.new_date, args.strategy, supabase);
    
    case 'create_custom_workout':
      return await createWorkout(userId, args, supabase);
    
    // ... outros cases
  }
}
```

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/ai-coach-chat/index.ts` | Modificar | Adicionar tools e loop de execução |
| `supabase/functions/ai-coach-chat/tools.ts` | Criar | Definições das tools (schema) |
| `supabase/functions/ai-coach-chat/executor.ts` | Criar | Lógica de execução das tools |

## Fluxo de Exemplo

**Usuário**: "Analise meu último treino de corrida"

```text
1. LLM recebe mensagem + lista de tools disponíveis
2. LLM decide chamar: get_last_activity(activity_type: "RUNNING")
3. Executor busca dados do banco
4. Resultado retorna ao LLM: { distance: 8.5km, pace: 5:23, hr_avg: 152, ... }
5. LLM gera análise baseada em dados REAIS
6. Resposta ao usuário com insights específicos
```

**Usuário**: "Preciso adiar meu treino de amanhã para sexta"

```text
1. LLM recebe mensagem + tools
2. LLM chama: get_training_plan() para ver workouts
3. LLM identifica o treino de amanhã
4. LLM chama: reschedule_workout(workout_id, "2026-02-07", "swap")
5. Executor move o treino no banco
6. LLM confirma: "Pronto! Seu treino de intervalados foi movido para sexta-feira."
```

## Benefícios

- **Autonomia real**: Coach busca dados automaticamente sem perguntar ao usuário
- **Ações executáveis**: Pode modificar agenda, criar treinos, reagendar
- **Contexto preciso**: Só busca dados quando necessário (economia de tokens)
- **Extensível**: Adicionar novas capacidades = adicionar nova tool
- **Segurança**: Todas as ações passam por validação de ownership

## Seção Técnica

### Modelo e Configuração
- Modelo: `google/gemini-2.5-flash` (já suporta tool calling)
- Max iterations: 5 (evitar loops infinitos)
- Timeout por tool: 10s

### Tratamento de Erros
- Se tool falhar, retornar erro estruturado ao LLM
- LLM pode tentar abordagem alternativa ou informar usuário

### Logging
- Registrar todas as tool calls em `ai_coach_conversations.context_used`
- Permitir auditoria de ações executadas

