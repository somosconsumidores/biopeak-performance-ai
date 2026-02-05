
# Plano: Implementar Melhorias de Produção no AI Coach

## Resumo

Implementar as melhorias críticas sugeridas para tornar o AI Coach production-ready, focando em segurança (rate limiting), robustez (error handling, timeout) e eficiência (history limit).

## Mudanças a Implementar

### 1. Rate Limiting (Prioridade Máxima)

Limitar a 20 mensagens por 5 minutos por usuário:

```typescript
async function checkRateLimit(userId: string, sb: any) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await sb
    .from('ai_coach_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', fiveMinAgo);
  
  if (count && count >= 20) {
    throw new Error('RATE_LIMIT');
  }
}
```

### 2. Aumentar MAX_ITERATIONS + Timeout

```typescript
const MAX_ITERATIONS = 10;  // Aumentar de 5 para 10
const TIMEOUT_MS = 25000;   // 25 segundos

// No loop:
const startTime = Date.now();
for (let i = 0; i < MAX_ITERATIONS && !finalResp; i++) {
  if (Date.now() - startTime > TIMEOUT_MS) {
    finalResp = "Processamento complexo demais. Tente uma pergunta mais específica.";
    break;
  }
  // ... resto do loop
}
```

### 3. Error Handling Melhorado

```typescript
catch (e: any) {
  console.error('AI Coach Error:', { userId: user?.id, error: e.message });
  
  let userMessage = 'Desculpe, ocorreu um erro. Tente novamente.';
  let status = 500;
  
  if (e.message === 'RATE_LIMIT') {
    userMessage = 'Você atingiu o limite de mensagens. Aguarde 5 minutos.';
    status = 429;
  } else if (e.message === 'Not authenticated') {
    userMessage = 'Sessão expirada. Faça login novamente.';
    status = 401;
  } else if (e.message.includes('AI error')) {
    userMessage = 'Serviço de IA indisponível. Tente em alguns instantes.';
    status = 503;
  }
  
  return new Response(JSON.stringify({ error: userMessage }), 
    { status, headers: corsHeaders });
}
```

### 4. Limitar Conversation History

Carregar apenas as últimas 20 mensagens (não ALL):

```typescript
if (reqConvId && !history.length) {
  const { data: prev } = await sb
    .from('ai_coach_conversations')
    .select('role, content')
    .eq('conversation_id', reqConvId)
    .order('created_at', { ascending: false })
    .limit(20);  // ✅ Últimas 20 apenas
  
  if (prev?.length) {
    history = prev.reverse().map((m: any) => ({ 
      role: m.role, 
      content: m.content 
    }));
  }
}
```

### 5. Tool Logging Enriquecido

Adicionar timing e status às tool calls (sem nova tabela):

```typescript
for (const tc of am.tool_calls) {
  const toolStart = Date.now();
  const args = JSON.parse(tc.function.arguments || '{}');
  const result = await executeTool(tc.function.name, args, sb, user.id);
  
  toolLog.push({ 
    tool: tc.function.name, 
    args,
    execution_ms: Date.now() - toolStart,
    success: !result.error
  });
  
  msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
}
```

### 6. System Prompt Otimizado

Versão condensada mantendo o essencial (menos tokens):

```typescript
function buildPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `Você é o BioPeak AI Coach - coach científico de corrida. DATA: ${today}

PERSONALIDADE: Consultivo, científico mas acessível, empático, celebra vitórias, honesto sobre riscos.

REGRAS CRÍTICAS:
1. DADOS REAIS: Nunca invente métricas. Chame get_athlete_metrics ANTES de criar treinos.
2. PROGRESSÃO: Nunca aumente volume >10%/semana. TSB negativo = sugerir recuperação.
3. SAÚDE PRIMEIRO: Dor/desconforto = alerta + ajustar plano. TSB < -15 = descanso forçado.
4. EXPLIQUE: Diga O PORQUÊ de cada recomendação.

TOOLS:
- get_athlete_metrics: OBRIGATÓRIO antes de criar treinos (VO2max, paces, zonas)
- create_scientific_workout: Treino estruturado (vo2max/threshold/tempo/long_run/recovery/speed/fartlek/progressive)
- get_last_activity, get_training_plan, get_fitness_scores, get_sleep_data: Consultas
- reschedule_workout, mark_workout_complete: Ações

FLUXO TREINO: 1) get_athlete_metrics → 2) create_scientific_workout com dados → 3) Mostrar treino detalhado

Responda em português, cite dados específicos, seja objetivo mas humano.`;
}
```

## Arquivo a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/ai-coach-chat/index.ts` | Rate limiting, timeout, error handling, history limit, tool logging, prompt |

## O Que NÃO Implementar Agora

| Sugestão | Motivo |
|----------|--------|
| Tabela `ai_coach_tool_logs` | Desnecessária - `context_used` já armazena isso |
| Streaming (SSE) | Complexo, requer mudanças no frontend |
| User Feedback | Precisa de UI no frontend primeiro |

## Resultado Esperado

- **Segurança**: Rate limiting previne abuse e custos inesperados
- **Robustez**: Erros claros, timeout evita travamentos
- **Eficiência**: History limitado = menos tokens = mais rápido e barato
- **Observability**: Tool logs com timing permitem debugar gargalos
