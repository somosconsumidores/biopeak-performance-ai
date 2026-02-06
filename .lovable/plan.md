

# Plano: Habilitar AI Coach a Responder sobre VO2Max

## Problema Identificado
O AI Coach possui a tool `get_athlete_metrics` que já busca VO2Max da tabela `garmin_vo2max`, mas:
1. A descrição da tool foca em "criar treinos científicos"
2. O prompt do sistema não instrui explicitamente a usar essa tool para perguntas sobre VO2Max
3. O AI não entende que deve consultar dados antes de responder sobre VO2Max

## Análise do Código Atual

### Tool Existente (linha 86-96)
```typescript
if (name === "get_athlete_metrics") {
  const { data: tokens } = await sb.from('garmin_tokens').select('garmin_user_id')...
  if (garminUserId) {
    const { data: vo2Data } = await sb.from('garmin_vo2max')
      .select('vo2_max_running, vo2_max_cycling')
      .eq('garmin_user_id', garminUserId)
      .order('calendar_date', { ascending: false })
      .limit(1).maybeSingle();
    vo2max = vo2Data?.vo2_max_running || vo2Data?.vo2_max_cycling || null;
  }
  ...
}
```

A lógica de busca está correta, mas o AI não está sendo guiado a usá-la.

## Solução Proposta

### 1. Atualizar Descrição da Tool
Modificar a descrição de `get_athlete_metrics` para ser mais explícita sobre VO2Max:

**Antes:**
```typescript
description: "Busca métricas do atleta: VO2max, paces de referência, FC máxima, zonas. 
              SEMPRE use antes de criar treinos científicos."
```

**Depois:**
```typescript
description: "Busca métricas fisiológicas do atleta: VO2max (Garmin), paces de referência, 
              FC máxima, zonas de treino. USE para perguntas sobre VO2max, capacidade aeróbica, 
              ou antes de criar treinos."
```

### 2. Adicionar Instrução no Prompt do Sistema
Adicionar regra explícita na seção "REGRA DE OURO":

```typescript
- Pergunta sobre VO2max/capacidade aeróbica? → Chame get_athlete_metrics PRIMEIRO
```

### 3. Enriquecer Retorno da Tool com Data
Incluir a data do último registro de VO2Max para dar contexto temporal:

```typescript
return { 
  found: true, 
  vo2max,
  vo2max_date: vo2Date, // Data do último registro
  hr_max: fcMax,
  ...
};
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-coach-chat/index.ts` | Atualizar descrição da tool + prompt + enriquecer retorno |

## Mudanças Detalhadas

### Modificação 1: Descrição da Tool (linha 28)
```typescript
{
  type: "function",
  function: {
    name: "get_athlete_metrics",
    description: "Busca métricas fisiológicas: VO2max (dados Garmin), paces de referência (5K, 10K), " +
                 "FC máxima, zonas de treino. USE SEMPRE para: perguntas sobre VO2max, capacidade aeróbica, " +
                 "zonas de frequência cardíaca, ou antes de criar treinos científicos.",
    parameters: { type: "object", properties: {}, additionalProperties: false }
  }
}
```

### Modificação 2: Prompt do Sistema (linha 328-332)
```typescript
REGRA DE OURO: Antes de responder qualquer pergunta, SEMPRE consulte os dados relevantes:
- Pergunta sobre VO2max/capacidade aeróbica/zonas? → Chame get_athlete_metrics PRIMEIRO
- Pergunta sobre plano? → Chame get_training_plan PRIMEIRO
- Pergunta sobre treino? → Chame get_athlete_metrics e get_training_plan
- Pergunta sobre performance? → Chame get_last_activity e get_fitness_scores
- Pergunta sobre cancelamento? → Chame get_training_plan para ver planos ativos
```

### Modificação 3: Enriquecer Retorno (linha 86-141)
Adicionar a data do registro de VO2Max no retorno:

```typescript
// Get VO2max from Garmin
let vo2max = null;
let vo2maxDate = null;
if (garminUserId) {
  const { data: vo2Data } = await sb.from('garmin_vo2max')
    .select('vo2_max_running, vo2_max_cycling, calendar_date')
    .eq('garmin_user_id', garminUserId)
    .order('calendar_date', { ascending: false })
    .limit(1).maybeSingle();
  vo2max = vo2Data?.vo2_max_running || vo2Data?.vo2_max_cycling || null;
  vo2maxDate = vo2Data?.calendar_date || null;
}

// ... no return:
return { 
  found: true, 
  vo2max,
  vo2max_date: vo2maxDate,
  vo2max_source: vo2max ? 'Garmin' : null,
  hr_max: fcMax,
  zones,
  best_paces: { ... },
  training_paces: paces,
  reference_pace_source: ...
};
```

## Resultado Esperado

Quando o usuário perguntar "Qual meu VO2Max?":

1. O AI reconhece a pergunta sobre VO2Max
2. Chama automaticamente `get_athlete_metrics`
3. Recebe os dados incluindo VO2Max de 52 (exemplo) e data 2026-02-05
4. Responde: "Seu VO2Max atual é **52 ml/kg/min** (registrado em 05/02/2026 via Garmin). Isso indica uma excelente capacidade aeróbica para..."

## Benefícios
- Zero mudança no frontend
- Aproveita infraestrutura existente
- AI passa a consultar dados antes de afirmar que não tem

