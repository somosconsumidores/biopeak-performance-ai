
# Plano: Fila Robusta para Notificações de Novas Atividades

## Situação Atual

O trigger `trg_notify_n8n_new_activity` faz chamada HTTP direta via `net.http_post`, causando:
- Erros 502/404 quando n8n está instável ou workflow inativo
- Sem retry automático - notificações perdidas
- Timeout de 5s do pg_net pode bloquear

## Arquitetura Proposta

Usar o mesmo padrão robusto de `n8n_notification_queue`:

```text
all_activities INSERT
        ↓
┌─────────────────────────────────┐
│ Trigger: Apenas insere na fila │
│ (Rápido, sem HTTP)             │
└─────────────────────────────────┘
        ↓
n8n_activity_notification_queue (status: pending)
        ↓
┌─────────────────────────────────┐
│ Edge Function: notify-n8n-     │
│ new-activity (invocada via     │
│ Cron ou manualmente)           │
└─────────────────────────────────┘
        ↓
   Sucesso? → status: completed
   Erro?    → status: error + retry_count++
```

## Mudanças

### 1. Criar Tabela de Fila

```sql
CREATE TABLE public.n8n_activity_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id TEXT,
  activity_type TEXT,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

ALTER TABLE public.n8n_activity_notification_queue 
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage activity queue"
  ON public.n8n_activity_notification_queue
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_activity_queue_pending 
  ON public.n8n_activity_notification_queue(status) 
  WHERE status = 'pending';
```

### 2. Modificar Trigger

Trocar chamada HTTP direta por INSERT na fila:

```sql
CREATE OR REPLACE FUNCTION public.trg_notify_n8n_new_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Só adiciona na fila para assinantes ativos
  IF EXISTS (
    SELECT 1 FROM public.subscribers 
    WHERE user_id = NEW.user_id AND subscribed = true
  ) THEN
    INSERT INTO public.n8n_activity_notification_queue 
      (user_id, activity_id, activity_type)
    VALUES 
      (NEW.user_id, NEW.activity_id, NEW.activity_type);
  END IF;
  RETURN NEW;
END;
$$;
```

### 3. Criar Edge Function

Nova função `notify-n8n-new-activity`:

```typescript
// supabase/functions/notify-n8n-new-activity/index.ts

Deno.serve(async (req) => {
  // Buscar pendentes da fila
  const { data: pending } = await supabase
    .from('n8n_activity_notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', 3)  // Max 3 tentativas
    .order('created_at')
    .limit(20);

  for (const item of pending) {
    try {
      const response = await fetch(
        'https://biopeak-ai.app.n8n.cloud/webhook/new-training-activity',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: item.user_id })
        }
      );

      if (response.ok) {
        // Sucesso - marcar como completed
        await supabase
          .from('n8n_activity_notification_queue')
          .update({ status: 'completed', processed_at: new Date() })
          .eq('id', item.id);
      } else {
        // Erro - incrementar retry
        await supabase
          .from('n8n_activity_notification_queue')
          .update({ 
            retry_count: item.retry_count + 1,
            error_message: `HTTP ${response.status}`,
            status: item.retry_count >= 2 ? 'failed' : 'pending'
          })
          .eq('id', item.id);
      }
    } catch (error) {
      // Erro de rede - incrementar retry
      await supabase
        .from('n8n_activity_notification_queue')
        .update({ 
          retry_count: item.retry_count + 1,
          error_message: error.message,
          status: item.retry_count >= 2 ? 'failed' : 'pending'
        })
        .eq('id', item.id);
    }
  }
});
```

### 4. Configurar Cron (Opcional)

Executar a cada minuto via pg_cron ou scheduler externo:

```sql
SELECT cron.schedule(
  'process-activity-notifications',
  '* * * * *',
  $$SELECT net.http_post(
    'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/notify-n8n-new-activity',
    headers := '{"Authorization": "Bearer ..."}',
    body := '{}'
  )$$
);
```

## Benefícios

| Antes (Direto) | Depois (Fila) |
|----------------|---------------|
| Perde se n8n falhar | Retry automático até 3x |
| Sem visibilidade | Logs em tabela consultável |
| Bloqueia trigger | Trigger instantâneo |
| Erro 502 = perdido | Erro 502 = retry depois |

## Arquivos a Criar/Modificar

1. **Migration SQL**: Criar tabela + modificar trigger
2. **`supabase/functions/notify-n8n-new-activity/index.ts`**: Edge function processadora
3. **`supabase/config.toml`**: Adicionar configuração da função

## URL do Webhook

A nova URL será: `https://biopeak-ai.app.n8n.cloud/webhook/new-training-activity`
