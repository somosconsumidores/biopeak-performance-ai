
# Plano: Tornar AI Coach Mais Proativo e Inteligente

## Problema Identificado

O AI Coach não está sendo proativo. Quando o atleta pede para cancelar o plano, ao invés de:
1. **Chamar `get_training_plan`** para ver quais planos estão ativos
2. **Propor o cancelamento específico** baseado nos dados

Ele pergunta passivamente: "Qual modalidade você gostaria de cancelar?"

**Causa raiz**: O system prompt instrui "confirme antes de cancelar" mas não diz "consulte os dados primeiro".

## Solução

Reescrever o system prompt para instruir o modelo a ser um **agente proativo** que sempre consulta os dados antes de responder.

## Mudanças no System Prompt

### Antes (atual):
```
REGRAS PARA CANCELAMENTO:
- SEMPRE confirme com o usuário antes de cancelar
- Pergunte o motivo para registro
- Após cancelar, sugira alternativas
```

### Depois (proposto):
```
COMPORTAMENTO PROATIVO:
Você é um coach que CONHECE o atleta. Antes de responder qualquer pergunta:
1. SEMPRE consulte os dados relevantes primeiro (planos, atividades, métricas)
2. Seja ESPECÍFICO: nunca pergunte o que você pode descobrir via tools
3. Proponha ações concretas baseadas nos dados encontrados

REGRAS PARA CANCELAMENTO:
- PRIMEIRO chame get_training_plan para ver quais planos estão ativos
- PROPONHA o cancelamento específico: "Você tem um plano de [tipo] [nome]. Confirma o cancelamento?"
- Pergunte o motivo apenas DEPOIS da confirmação
- Após cancelar, sugira alternativas (novo plano, pausa, etc)

EXEMPLOS DE PROATIVIDADE:
✅ Atleta: "Quero cancelar meu plano"
   Coach: [chama get_training_plan] → "Vi que você tem um Plano de Corrida 10K. Confirma o cancelamento?"

❌ Atleta: "Quero cancelar meu plano"
   Coach: "Qual modalidade você quer cancelar?" (ERRADO - dados estão disponíveis!)
```

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-coach-chat/index.ts` | Atualizar `buildPrompt()` com instruções de proatividade |

## Resultado Esperado

O AI Coach passará a:
1. Consultar automaticamente os dados relevantes
2. Propor ações específicas baseadas nos dados encontrados
3. Nunca perguntar informações que ele pode descobrir via tools
4. Agir como um coach que realmente **conhece** o atleta
