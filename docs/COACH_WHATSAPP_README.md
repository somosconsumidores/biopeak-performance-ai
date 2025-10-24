# 📲 BioPeak Personal Coach WhatsApp - Documentação

## 🎯 Visão Geral

O BioPeak Personal Coach via WhatsApp é um sistema de coaching automatizado que permite aos usuários interagirem com seus planos de treino através do WhatsApp. O sistema envia lembretes, permite marcar treinos como concluídos, reagendar treinos e responder perguntas sobre o plano.

### Arquitetura

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│   WhatsApp  │◄────►│     n8n     │◄────►│   Supabase   │
│  (Usuário)  │      │(Orquestrador)│      │  (Backend)   │
└─────────────┘      └─────────────┘      └──────────────┘
                            │                      │
                            │                      │
                     ┌──────▼──────┐        ┌──────▼──────┐
                     │  Provedor   │        │Edge Functions│
                     │  WhatsApp   │        │ + Database   │
                     │(Zaap/Gupshup)│       └─────────────┘
                     └─────────────┘
```

## 📊 Database Schema

### Tabela: `coach_threads`
Armazena o estado da conversa por usuário/plano.

```sql
CREATE TABLE coach_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  phone text NOT NULL,
  provider text DEFAULT 'zaap',
  context jsonb NOT NULL DEFAULT '{}',
  last_intent text DEFAULT 'idle',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, plan_id)
);
```

**Campos importantes:**
- `context`: Snapshot do plano (resumo + próximos 60-90 dias de treinos)
- `last_intent`: Estado da conversa (`idle` | `awaiting_new_date` | `confirming_reschedule`)
- `phone`: Telefone normalizado no formato `55DDDNNNNNNNN`

### Tabela: `coach_events`
Log de todos os eventos do coaching.

```sql
CREATE TABLE coach_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  phone text,
  event_type text NOT NULL,
  message_id text,
  payload jsonb DEFAULT '{}',
  error_message text,
  created_at timestamptz DEFAULT now()
);
```

**Tipos de eventos:**
- `welcome`: Mensagem de boas-vindas enviada
- `reminder`: Lembrete diário enviado
- `done_marked`: Treino marcado como concluído
- `reschedule`: Treino reagendado
- `qa`: Pergunta respondida
- `delivery_failed`: Falha no envio de mensagem
- `followup`: Follow-up pós-treino

## 🔐 Variáveis de Ambiente

### Supabase Edge Functions

```bash
COACH_EDGE_KEY=<UUID v4 gerado para autenticação>
SUPABASE_URL=https://grcwlmltlcltmwbhdpky.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key do projeto>
```

### n8n

```bash
COACH_EDGE_BASE_URL=https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1
COACH_EDGE_KEY=<mesmo UUID do Supabase>
WHATSAPP_API_KEY=<token do provedor Zaap/Gupshup>
WHATSAPP_WEBHOOK_SECRET=<para validar webhooks recebidos>
TZ=America/Sao_Paulo
```

## 🚀 Edge Functions

### 1. coach-get-context

**Endpoint:** `POST /functions/v1/coach-get-context`

**Descrição:** Retorna contexto completo do plano para o n8n.

**Headers:**
```
x-coach-key: <COACH_EDGE_KEY>
Content-Type: application/json
```

**Input:**
```json
{
  "plan_id": "uuid",
  "user_id": "uuid" // opcional, para validação extra
}
```

**Output:**
```json
{
  "plan": {
    "id": "uuid",
    "plan_name": "Plano Maratona 16 semanas",
    "goal_type": "42k",
    "start_date": "2025-02-01",
    "end_date": "2025-05-25",
    "weeks": 16,
    "status": "active",
    "target_event_date": "2025-05-25",
    "goal_target_time_minutes": 225
  },
  "prefs": {
    "days_per_week": 4,
    "days_of_week": ["monday", "wednesday", "friday", "sunday"],
    "long_run_weekday": "sunday"
  },
  "profile": {
    "display_name": "João Silva",
    "email": "joao@email.com",
    "phone": "5511987654321",
    "gender": "male"
  },
  "workouts": [
    {
      "id": "uuid",
      "workout_date": "2025-02-01",
      "title": "Corrida Leve 8 km",
      "description": "Ritmo confortável...",
      "workout_type": "easy",
      "target_pace_min_km": 5.5,
      "distance_meters": 8000,
      "duration_minutes": 44,
      "status": "planned"
    }
  ],
  "stats": {
    "total_workouts": 64,
    "completed_count": 12,
    "upcoming_count": 52,
    "next_workout_date": "2025-02-01"
  }
}
```

---

### 2. coach-mark-done

**Endpoint:** `POST /functions/v1/coach-mark-done`

**Descrição:** Marca treino como completado.

**Headers:**
```
x-coach-key: <COACH_EDGE_KEY>
Content-Type: application/json
```

**Input:**
```json
{
  "user_id": "uuid",
  "plan_id": "uuid",
  "workout_date": "2025-02-01" // YYYY-MM-DD
}
```

**Output (Sucesso):**
```json
{
  "success": true,
  "message": "Treino marcado como concluído",
  "workout": {
    "id": "uuid",
    "title": "Corrida Leve 8 km",
    "workout_date": "2025-02-01",
    "status": "completed"
  }
}
```

**Output (Não encontrado):**
```json
{
  "success": false,
  "message": "Nenhum treino encontrado para hoje ou ontem"
}
```

**Regras de negócio:**
- Busca treino na data especificada
- Se não encontrar, tenta buscar ontem (caso tenha completado tarde)
- Se já está `completed`, retorna sucesso sem alterar
- Loga evento em `coach_events` tipo `done_marked`

---

### 3. coach-reschedule

**Endpoint:** `POST /functions/v1/coach-reschedule`

**Descrição:** Move treino de uma data para outra.

**Headers:**
```
x-coach-key: <COACH_EDGE_KEY>
Content-Type: application/json
```

**Input:**
```json
{
  "user_id": "uuid",
  "plan_id": "uuid",
  "from_date": "2025-02-01", // YYYY-MM-DD
  "to_date": "2025-02-03",   // YYYY-MM-DD
  "strategy": "replace" // 'replace' | 'swap' | 'push' (default: 'replace')
}
```

**Output (Sucesso):**
```json
{
  "success": true,
  "message": "Treino reagendado com sucesso",
  "moved_workout": {
    "id": "uuid",
    "title": "Corrida Leve 8 km",
    "old_date": "2025-02-01",
    "new_date": "2025-02-03"
  },
  "conflicts": [
    {
      "id": "uuid",
      "title": "Treino de Ritmo 10 km",
      "date": "2025-02-03",
      "action": "replaced"
    }
  ]
}
```

**Estratégias:**
- **`replace`**: Move para `to_date`, sobrescreve se houver conflito
- **`swap`**: Troca as datas dos dois treinos
- **`push`**: Move para `to_date`, empurra conflito para `to_date + 1 day`

**Regras de negócio:**
- `to_date` deve estar dentro do range do plano (`start_date` a `end_date`)
- Máximo 2 reagendamentos por semana (opcional)
- Se `from_date` já passou, permite reagendar para futuro
- Loga evento em `coach_events` tipo `reschedule`

## 🤖 Workflows n8n

### Workflow A: coach-on-plan-created

**Trigger:** Webhook do Supabase quando plano fica `status='active'`.

**Fluxo:**
1. Recebe webhook com `{ plan_id, user_id }`
2. Chama `coach-get-context` para buscar dados
3. Extrai telefone do profile
4. Insere registro em `coach_threads`
5. Envia mensagem de boas-vindas no WhatsApp
6. Loga evento em `coach_events` tipo `welcome`

**Mensagem de Boas-vindas:**
```
🎯 Bem-vindo ao BioPeak Personal Coach!

Vou te avisar dos treinos, explicar o objetivo de cada sessão e ajustar seu plano quando precisar.

📅 Seu plano: Plano Maratona 16 semanas
🎯 Meta: 42k em 16 semanas
📆 Início: 01/02/2025

Comandos:
• "Detalhes" — treino do dia
• "Feito" — marco o treino como concluído
• "Reagendar" — mudo o dia/horário
• "Ajuda" — lista de comandos

Bora! 💪🏃‍♂️
```

---

### Workflow B: coach-daily-reminder

**Trigger:** CRON diário às 18:00 (TZ: America/Sao_Paulo).

**Fluxo:**
1. Busca treinos de amanhã (query: `get_tomorrow_workouts_for_reminder()`)
2. Loop por cada treino
3. Busca contexto em `coach_threads`
4. Monta mensagem de lembrete
5. Envia WhatsApp
6. Loga evento em `coach_events` tipo `reminder`

**Mensagem de Lembrete:**
```
👟 Amanhã (02/02): Corrida Leve 8 km

📏 Distância: 8 km
⏱️ Pace alvo: 5:30/km
🎯 Tipo: Easy Run

💡 Dica: Mantenha ritmo confortável, deve conseguir conversar.

Responda:
• "Feito" — quando terminar
• "Reagendar" — para outro dia
• "Detalhes" — explico o objetivo
```

---

### Workflow C: coach-whatsapp-inbound

**Trigger:** Webhook do provedor WhatsApp quando usuário envia mensagem.

**Fluxo:**
1. Recebe webhook: `{ message_id, from, text, timestamp }`
2. Verifica idempotência (já processado?)
3. Normaliza telefone
4. Busca `coach_threads` por phone
5. Detecta intent (regex simples)
6. Roteamento por intent:
   - **`done`**: Chama `coach-mark-done` → confirma
   - **`reschedule`**: 
     - 1ª msg: Pede data → Update intent `awaiting_new_date`
     - 2ª msg: Parse data → Chama `coach-reschedule` → confirma
   - **`details`**: Mostra treino do dia
   - **`help`**: Mostra menu de ajuda
   - **`cancel`**: Confirma cancelamento
   - **`other`**: QA (LLM ou rule-based)
7. Loga evento em `coach_events`

**Intent Detection (Regex):**
```javascript
const text = message.text.toLowerCase().trim();

if (/^(feito|done|concluído)$/i.test(text)) intent = 'done';
else if (/^(reagendar|adiar|mudar)$/i.test(text)) intent = 'reschedule';
else if (/^(detalhes|explica)$/i.test(text)) intent = 'details';
else if (/^(ajuda|help)$/i.test(text)) intent = 'help';
else if (/^(cancelar|parar)$/i.test(text)) intent = 'cancel';
else intent = 'other';
```

---

### Workflow D: coach-post-workout-followup

**Trigger:** CRON diário às 21:00 (TZ: America/Sao_Paulo).

**Fluxo:**
1. Busca treinos de hoje ainda `planned` (query: `get_today_incomplete_workouts()`)
2. Loop por cada treino
3. Envia mensagem de follow-up
4. Loga evento em `coach_events` tipo `followup`

**Mensagem de Follow-up:**
```
🏃‍♂️ E aí, treino de hoje foi realizado?

📅 Corrida Leve 8 km

Responda:
• "Feito" — marco como concluído
• "Reagendar" — mudo para outro dia
• "Pulei" — marco como pulado (sem problemas!)

É importante manter o registro atualizado! 💪
```

---

### Workflow E: coach-delivery-watchdog

**Trigger:** Anexado aos nós de envio WhatsApp (on error).

**Fluxo:**
1. Captura erro de envio
2. Aguarda 5 minutos
3. Retry (até 2 tentativas)
4. Se falhar: Loga `coach_events` tipo `delivery_failed`
5. Notifica admin via Slack (opcional)

## 📱 Integração WhatsApp

### Provedor: Zaap ou Gupshup

**Configuração no n8n:**

**Envio (HTTP Request):**
```javascript
POST https://api.zaap.com/v1/send
Headers:
  Authorization: Bearer <WHATSAPP_API_KEY>
  Content-Type: application/json
Body:
{
  "phone": "5511987654321",
  "message": "Texto da mensagem"
}
```

**Webhook de Recebimento:**
```
URL: https://n8n.biopeak.app/webhook/coach-inbound
Method: POST
Payload:
{
  "message_id": "wamid.ABC123...",
  "from": "5511987654321",
  "text": "Feito",
  "timestamp": 1706540800
}
```

### Normalização de Telefone

Sempre usar formato `55DDDNNNNNNNN` (11 dígitos para Brasil):
- ✅ Correto: `5511987654321`
- ❌ Errado: `+55 11 98765-4321`, `11987654321`, `5511 987654321`

## 🧪 Testes End-to-End

### Cenário 1: Criação de Plano
1. Criar plano no app BioPeak (status='active')
2. ✅ Receber mensagem de boas-vindas no WhatsApp
3. ✅ Verificar inserção em `coach_threads`
4. ✅ Verificar log em `coach_events` tipo `welcome`

### Cenário 2: Lembrete Diário
1. CRON às 18:00 dispara
2. ✅ Receber lembrete do treino de amanhã
3. ✅ Mensagem contém: distância, pace, tipo, dica
4. ✅ Verificar log em `coach_events` tipo `reminder`

### Cenário 3: Marcar como Feito
1. Responder "Feito" no WhatsApp
2. ✅ Receber confirmação: "✅ Treino marcado como concluído!"
3. ✅ Verificar `training_plan_workouts.status = 'completed'`
4. ✅ Verificar log em `coach_events` tipo `done_marked`

### Cenário 4: Reagendar
1. Responder "Reagendar"
2. ✅ Receber: "📅 Qual dia você prefere?"
3. Responder "Sábado" ou "15/02"
4. ✅ Receber confirmação com nova data
5. ✅ Verificar `training_plan_workouts.workout_date` alterado
6. ✅ Verificar log em `coach_events` tipo `reschedule`

### Cenário 5: Detalhes
1. Responder "Detalhes"
2. ✅ Receber descrição completa do treino de hoje
3. ✅ Mensagem contém: título, distância, pace, objetivo

## 🔍 Troubleshooting

### Problema: Mensagens não chegam

**Diagnóstico:**
1. Verificar se telefone está cadastrado em `profiles.phone`
2. Verificar formato do telefone (deve ser `55DDDNNNNNNNN`)
3. Verificar logs de `coach_events` tipo `delivery_failed`
4. Verificar logs do n8n (executions)

**Solução:**
- Atualizar telefone no perfil
- Corrigir formato do telefone
- Verificar credenciais do provedor WhatsApp

---

### Problema: Treino não marca como concluído

**Diagnóstico:**
1. Verificar logs da Edge Function `coach-mark-done`
2. Verificar se usuário tem permissão no plano
3. Verificar se treino existe na data especificada

**Solução:**
- Verificar se `plan_id` e `user_id` estão corretos
- Verificar se `workout_date` é hoje ou ontem
- Verificar RLS policies em `training_plan_workouts`

---

### Problema: Reagendamento falha

**Diagnóstico:**
1. Verificar logs da Edge Function `coach-reschedule`
2. Verificar se `to_date` está dentro do range do plano
3. Verificar estratégia de conflito

**Solução:**
- Garantir que `to_date` está entre `start_date` e `end_date` do plano
- Usar estratégia apropriada: `replace`, `swap` ou `push`
- Verificar se treino de origem existe

---

### Problema: CRON não dispara

**Diagnóstico:**
1. Verificar configuração de timezone no n8n (`TZ=America/Sao_Paulo`)
2. Verificar se workflow está ativo
3. Verificar logs de execução do n8n

**Solução:**
- Ativar workflow no n8n
- Corrigir expressão CRON
- Reiniciar n8n se necessário

## 📊 Observabilidade

### Queries úteis

**Resumo diário de eventos:**
```sql
SELECT 
  event_type,
  DATE(created_at) as date,
  COUNT(*) as count
FROM coach_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY event_type, DATE(created_at)
ORDER BY date DESC, count DESC;
```

**Taxa de conclusão de treinos:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as completion_rate
FROM training_plan_workouts
WHERE workout_date >= CURRENT_DATE - INTERVAL '30 days'
  AND workout_date < CURRENT_DATE;
```

**Usuários ativos (com phone cadastrado):**
```sql
SELECT COUNT(DISTINCT user_id) 
FROM coach_threads 
WHERE phone IS NOT NULL;
```

## 🎯 Próximos Passos

### Fase 1: Foundation ✅
- [x] Criar migração SQL (tabelas + RLS)
- [x] Desenvolver Edge Functions
- [x] Adicionar campo `phone` no cadastro
- [x] Documentação

### Fase 2: Core Workflows
- [ ] Workflow A: On Plan Created
- [ ] Workflow B: Daily Reminder
- [ ] Testes de integração com provedor WhatsApp

### Fase 3: Interactive Flows
- [ ] Workflow C: WhatsApp Inbound (intents básicos)
- [ ] Helper de parsing de datas
- [ ] Testes de conversação real

### Fase 4: Polish & Scale
- [ ] Workflow D: Post-workout Followup
- [ ] Workflow E: Delivery Watchdog
- [ ] Dashboard de métricas

### Fase 5: Launch
- [ ] Beta com 10-20 usuários reais
- [ ] Coleta de feedback
- [ ] Release geral

## 🚀 Melhorias Futuras (v2)

1. **LLM Integration**: Usar GPT-4 para QA avançado
2. **Voice Messages**: Suporte a áudios do WhatsApp
3. **Rich Media**: Enviar imagens de mapas de rota, gráficos
4. **Proatividade**: AI detecta padrões e sugere ajustes
5. **Multi-idioma**: Suporte a inglês/espanhol
6. **WhatsApp Business API Oficial**: Templates aprovados

## 📞 Suporte

Para dúvidas ou problemas:
- **Email**: suporte@biopeak.app
- **Slack**: #coach-whatsapp
- **Documentação Supabase**: https://supabase.com/docs

---

**Última atualização:** 2025-01-29
**Versão:** 1.0.0
