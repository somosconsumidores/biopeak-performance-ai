
## Duas Correções Cirúrgicas na Edge Function ai-coach-chat

### Diagnóstico

**Problema 1 — CTL/ATL/TSB absurdos (879/267/612)**

A query em `get_fitness_scores` (linha 79) já filtra corretamente por `user_id`. O problema é que os valores brutos no banco estão em escala errada (a tabela `fitness_scores_daily` armazena 879 onde deveria ser ~87.9 — provavelmente multiplicados por 10 durante o cálculo). O LLM recebe esses valores sem nenhum filtro de sanidade, e mesmo com a instrução no prompt ("CTL/ATL fora de 0–200 = inválido"), o modelo está reportando os números absurdos antes de descartá-los.

**Correção**: Aplicar a sanitização **no código da tool**, antes de entregar ao LLM. Se CTL > 200, retornar `{ found: false, reason: "Valores fora do intervalo esperado (CTL/ATL 0–200). Dado indisponível — tente recalcular via painel." }`.

---

**Problema 2 — Resumo mensal percorre dia a dia**

A tool `get_activity_by_date` aceita uma data específica (YYYY-MM-DD). Quando o usuário pergunta "Como foi minha performance em janeiro?", o LLM não tem uma tool agregada disponível e tenta percorrer dia a dia com `get_activity_by_date`. 

A função `weekly_summary_stats_v2` já existe no banco e aceita `start_date` / `end_date` — ou seja, pode ser chamada para um mês inteiro. Ela retorna: distância total, contagem de atividades, dias ativos, calorias, horas, pace médio, FC média/máxima, ganho de elevação, maior distância, melhor pace, comparação com período anterior, tipos de atividade, score de consistência.

**Correção**: Adicionar uma nova tool `get_monthly_summary` que chama `weekly_summary_stats_v2` com `start_date = primeiro dia do mês` e `end_date = último dia do mês`, e adicionar instrução no prompt para usá-la sempre que a intenção for análise mensal.

---

### Mudanças Técnicas

**Arquivo**: `supabase/functions/ai-coach-chat/index.ts`

#### 1. Nova tool `get_monthly_summary` no array `coachTools` (linha 32)

```typescript
{
  type: "function",
  function: {
    name: "get_monthly_summary",
    description: "Resumo agregado de performance de um mês inteiro. USE SEMPRE que o usuário perguntar sobre performance mensal, 'como foi meu mês', 'janeiro', 'fevereiro', etc. Nunca use get_activity_by_date para análise mensal.",
    parameters: {
      type: "object",
      properties: {
        year: { type: "number", description: "Ano (ex: 2026)" },
        month: { type: "number", description: "Mês (1-12)" }
      },
      required: ["year", "month"],
      additionalProperties: false
    }
  }
}
```

#### 2. Implementação da tool `get_monthly_summary` em `executeTool()` (antes do `return { error: 'Tool desconhecida' }` na linha 342)

A implementação vai:
- Calcular `start_date` e `end_date` a partir de `year` e `month`
- Calcular `previous_start_date` e `previous_end_date` (mês anterior)
- Chamar `weekly_summary_stats_v2` via RPC com os 4 parâmetros
- Filtrar o resultado pelo `user_id` do atleta
- Retornar objeto formatado com as métricas principais (distância, atividades, pace médio, pace recorde, horas, FC média, calorias, comparação vs mês anterior, tipos de atividade)

#### 3. Sanitização em `get_fitness_scores` (linha 78–83)

Substituir o retorno atual por:

```typescript
if (name === "get_fitness_scores") {
  const { data } = await sb.from('fitness_scores_daily')
    .select('calendar_date, ctl_42day, atl_7day')
    .eq('user_id', uid)
    .order('calendar_date', { ascending: false })
    .limit(1).maybeSingle();
  
  if (!data) return { found: false, reason: "Nenhum dado de carga encontrado" };
  
  const ctl = data.ctl_42day;
  const atl = data.atl_7day;
  
  // Sanity check: valores fora de 0–200 são inválidos
  if (!ctl || !atl || ctl > 200 || atl > 200 || ctl < 0 || atl < 0) {
    return {
      found: false,
      reason: `Valores de CTL/ATL fora do intervalo esperado (CTL: ${ctl?.toFixed(1)}, ATL: ${atl?.toFixed(1)}). Dado indisponível — verifique o cálculo no painel BioPeak.`
    };
  }
  
  const tsb = ctl - atl;
  return {
    found: true,
    ctl: ctl.toFixed(1),
    atl: atl.toFixed(1),
    tsb: tsb.toFixed(1),
    date: data.calendar_date,
    status: tsb > 25 ? 'Muito fresco — volume baixo recente'
           : tsb > 5  ? 'Fresco — pronto para treino intenso'
           : tsb > -5 ? 'Balanceado'
           : tsb > -25? 'Sob carga — monitore recuperação'
           :            'Fadiga acumulada — priorize descanso'
  };
}
```

#### 4. Atualização do `buildPrompt()` (seção de tools e fluxo)

- Adicionar `get_monthly_summary` à lista de tools disponíveis na seção == 4. TOOLS DISPONÍVEIS ==
- Reforçar na seção == 3. FLUXO DE CONVERSA ==: "Intenção = análise mensal/evolução → `get_monthly_summary`"
- Remover a instrução ambígua "análise mensal → get_fitness_scores + get_athlete_metrics" que induzia o LLM a não usar a tool correta

---

### Impacto

| Cenário | Antes | Depois |
|---|---|---|
| "Qual meu CTL/ATL hoje?" | Retorna 879/267/612 (valores absurdos) | Retorna "Dado indisponível — verifique o cálculo no painel BioPeak" |
| "Como foi minha performance em janeiro?" | Percorre dia a dia com `get_activity_by_date` | Chama `get_monthly_summary` → 1 RPC, dados agregados completos |
| Criação de treino | Continua funcionando normalmente | Sem impacto |

### Deploy

A edge function `ai-coach-chat` será re-deployada automaticamente após as edições. Nenhuma migração de banco é necessária — `weekly_summary_stats_v2` já existe.
