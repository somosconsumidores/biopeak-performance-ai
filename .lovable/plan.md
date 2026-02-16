

## Plano: Trigger de replicacao HealthKit para Garmin Sleep Summaries

### Contexto
O usuario quer que dados inseridos em `healthkit_sleep_summaries` sejam automaticamente replicados para `garmin_sleep_summaries`, eliminando a necessidade de alterar dashboards e edge functions que hoje so consultam a tabela Garmin.

### Abordagem
Criar uma trigger `AFTER INSERT OR UPDATE` na tabela `healthkit_sleep_summaries` que faz um `INSERT ... ON CONFLICT DO NOTHING` na `garmin_sleep_summaries`, **somente se nao existir um registro Garmin real** para aquele usuario+data.

### Logica da Trigger

1. Verificar se ja existe um registro na `garmin_sleep_summaries` para o mesmo `user_id` + `calendar_date` que **nao** comece com `'healthkit_'` no `summary_id` (ou seja, um registro real do Garmin)
2. Se existir registro Garmin real: nao fazer nada (Garmin tem prioridade)
3. Se nao existir: fazer UPSERT com os dados do HealthKit, usando `summary_id = 'healthkit_' || calendar_date`

### Mapeamento de Campos

```text
healthkit.total_sleep_seconds   -> garmin.sleep_time_in_seconds
healthkit.deep_sleep_seconds    -> garmin.deep_sleep_duration_in_seconds
healthkit.light_sleep_seconds   -> garmin.light_sleep_duration_in_seconds
healthkit.rem_sleep_seconds     -> garmin.rem_sleep_duration_in_seconds
healthkit.awake_seconds         -> garmin.awake_duration_in_seconds
healthkit.sleep_score           -> garmin.sleep_score
healthkit.source_name           -> garmin.sleep_score_feedback (para identificacao)
summary_id                      -> 'healthkit_' || NEW.calendar_date::TEXT
```

Campos exclusivos do Garmin (`avg_sleep_stress`, `age_group`, `sleep_score_insight`, etc.) ficarao `NULL`.

Para `sleep_start_time_in_seconds` e `sleep_end_time_in_seconds`, sera feita a conversao de timestamp para epoch (segundos desde meia-noite GMT do dia).

### Trigger para Polar Sleep

A mesma logica sera aplicada para a tabela `polar_sleep`, criando uma segunda trigger que replica dados Polar para `garmin_sleep_summaries` com `summary_id = 'polar_' || calendar_date`.

### Protecao contra conflitos

- Se o usuario tiver Garmin **e** HealthKit, o dado do Garmin prevalece (a trigger nao sobrescreve)
- Se o usuario so tiver HealthKit, o dado aparece na tabela Garmin normalmente
- Se um dado Garmin chegar depois do HealthKit, o registro do HealthKit sera preservado (ON CONFLICT DO NOTHING), a menos que adicionemos logica para deletar o registro sintetico

### Riscos e Consideracoes

- **Dados sinteticos misturados com reais**: queries que filtram por `summary_id` podem precisar de ajuste
- **Limpeza futura**: se o usuario conectar Garmin depois, os registros `healthkit_*` ficarao orfaos
- **Alternativa mais limpa**: uma view unificada (`unified_sleep`) evitaria esses problemas, mas exigiria alterar edge functions e dashboard

### Detalhes Tecnicos da Migracao SQL

Uma unica migracao contendo:

1. Funcao `fn_replicate_healthkit_to_garmin()` com logica de UPSERT condicional
2. Trigger `trg_replicate_healthkit_to_garmin` na tabela `healthkit_sleep_summaries` (AFTER INSERT OR UPDATE)
3. Funcao `fn_replicate_polar_to_garmin()` com logica similar
4. Trigger `trg_replicate_polar_to_garmin` na tabela `polar_sleep` (AFTER INSERT OR UPDATE)
5. Script de backfill para replicar dados historicos ja existentes nas tabelas HealthKit e Polar

