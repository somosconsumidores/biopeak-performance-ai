

# Mudanca: Trigger Direto para Webhook (Sem Fila)

## Objetivo

Reverter a arquitetura de fila e fazer o trigger `trg_notify_n8n_new_activity` chamar diretamente o webhook n8n via `net.http_post` a cada novo registro de atividade de assinante.

## Mudancas

### 1. Modificar o Trigger

Substituir o INSERT na fila por uma chamada HTTP direta usando `net.http_post` (extensao pg_net do Supabase):

```sql
CREATE OR REPLACE FUNCTION public.trg_notify_n8n_new_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.subscribers 
    WHERE user_id = NEW.user_id AND subscribed = true
  ) THEN
    PERFORM net.http_post(
      url := 'https://biopeak-ai.app.n8n.cloud/webhook/new-training-activity',
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'activity_id', NEW.activity_id,
        'activity_type', NEW.activity_type,
        'timestamp', now(),
        'source', 'BioPeak Activity Trigger'
      ),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  END IF;
  RETURN NEW;
END;
$$;
```

### 2. Limpeza (Opcional)

Remover recursos que nao serao mais necessarios:
- Tabela `n8n_activity_notification_queue`
- Edge Function `notify-n8n-new-activity`
- Entrada no `supabase/config.toml`

## Riscos

- Se o n8n estiver fora do ar ou o workflow inativo, a notificacao sera perdida (sem retry)
- Erros HTTP (502/404) nao serao tratados automaticamente

## Arquivos Afetados

1. **Migration SQL**: Alterar funcao do trigger
2. **`supabase/functions/notify-n8n-new-activity/index.ts`**: Remover
3. **`supabase/config.toml`**: Remover entrada da funcao

