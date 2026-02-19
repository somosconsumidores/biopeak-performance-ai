
## Atualização do System Prompt do BioPeak Coach IA

### O que será alterado

Apenas a função `buildPrompt()` na edge function `supabase/functions/ai-coach-chat/index.ts` (linhas 345–396). Nenhuma outra parte do código será tocada.

### Diferenças entre o prompt atual e o novo

| Aspecto | Prompt Atual | Novo Prompt |
|---|---|---|
| Limite de palavras | Sem limite explícito | Máximo 120 palavras por resposta |
| Formato de resposta | Livre | Estruturado: 📊 Resumo / 💡 Insights / ✅ Próximos passos |
| Validação de dados | Não invente métricas | Mesma regra + tratamento explícito de erros de API |
| TSB automático | Sugestão se TSB < -15 | Alert automático se TSB > +25 ou < -25 |
| Ferramenta de carga | `get_fitness_scores` | Mantida, com nova regra: valores >250 ou negativos = "indisponível" |
| Fallback de erros | Genérico | Mensagem específica: "Não consegui puxar X (erro Y). Posso tentar?" |
| Hook futuro | Não existe | "Quer que eu crie um relatório em PDF?" quando usuário perguntar sobre o mês |
| Sanidade de dados | Não existe | CTL/ATL fora de 0–200 tratado como inválido |
| Tone of voice | "científico mas acessível" | Técnico próximo, sem clichês motivacionais, embasado em dados |

### Compatibilidade com as tools existentes

O novo prompt referencia os mesmos tools já implementados:
- `get_fitness_scores` → CTL, ATL, TSB (já existe)
- `get_athlete_metrics` → VO2max, paces, zonas (já existe)
- `get_training_plan` → Planos ativos (já existe)
- `get_last_activity` / `get_activity_by_date` (já existem)
- `create_scientific_workout`, `reschedule_workout`, `cancel_training_plan` (já existem)

As referências a endpoints como `GET /functions/get_training_load_summary` no prompt original do usuário são tratadas como **instruções comportamentais** para o modelo — o agente usará as tools existentes para buscar esses dados. Não há necessidade de criar novos endpoints.

### Mudança técnica

**Arquivo**: `supabase/functions/ai-coach-chat/index.ts`
**Linha**: 345–396 (função `buildPrompt()`)

O novo prompt será estruturado em 5 seções claramente delimitadas:
1. **Princípios gerais** — confiança, contexto contínuo, ação concreta, modo curto, fonte clara
2. **Dados e sanidade** — regras de validação (CTL/ATL 0–200, fallback explícito)
3. **Ações suportadas** — criar treino, reagendar/cancelar, apagar duplicado
4. **Fluxo de conversa** — checagem inicial → resposta formatada → follow-up automático
5. **Restrições e tom de voz** — fallback de erros, Português BR, termos técnicos de corrida

### Deploy

A edge function será **re-deployada automaticamente** após a edição. O usuário pode testar imediatamente no `/ai-coach`.
