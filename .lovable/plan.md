
# Deduplicacao de Atividades para Assinantes Ativos

## Diagnostico

A analise revelou dados significativos sobre duplicacao:
- **140 usuarios** sincronizam Garmin e Strava simultaneamente
- **~6.289 pares duplicados** Garmin+Strava
- **~670 pares duplicados** adicionais (Polar+Strava: 270, HealthKit+Strava: 294, HealthKit+Garmin: 106)
- Total de atividades de assinantes ativos: ~9.793

## Estrategia de Deduplicacao

A identificacao de duplicatas sera feita por: **mesmo user_id + mesma activity_date + duracao similar (ROUND de total_time_minutes)**. Quando houver duplicatas, a prioridade e:

1. **Garmin** (maior prioridade - dados mais completos)
2. **Polar**
3. **HealthKit**
4. **Strava**
5. **BioPeak / Zepp / Zepp GPX / Strava GPX** (menor prioridade)

## Arquitetura

Sera criada uma **tabela regular** (nao materialized view) chamada `all_activities_deduplicada_subscribers`. Motivo: materialized views no PostgreSQL nao suportam refresh incremental real - sempre recomputa a query inteira. Uma tabela regular permite insercoes e delecoes cirurgicas, garantindo performance no cron job.

### Fluxo

```text
+---------------------------+
|   all_activities (fonte)  |
+---------------------------+
            |
   [Dedup: ROW_NUMBER por   ]
   [user + date + round(min)]
   [ORDER BY prioridade]     
            |
            v
+---------------------------------------+
| all_activities_deduplicada_subscribers |
|  (tabela - apenas assinantes ativos)  |
+---------------------------------------+
            ^
            |
   [Cron midnight: incremental]
   [Processa ultimas 24h]
```

## Mudancas Planejadas

### 1. Migration SQL

**Tabela `all_activities_deduplicada_subscribers`**: mesmas colunas de `all_activities`, com indice unico para suporte a upsert.

**RPC `populate_deduplicada_subscribers_full`**: Faz o rebuild completo (usado apenas na primeira vez ou em caso de necessidade).

**RPC `populate_deduplicada_subscribers_incremental`**: Remove registros dos ultimos 2 dias (margem de seguranca) de usuarios que tiveram novas atividades, e reinsere de forma deduplicada. Isso garante que atividades sincronizadas com atraso tambem sejam tratadas.

**Logica de deduplicacao (SQL)**:
```sql
ROW_NUMBER() OVER (
  PARTITION BY user_id, activity_date, ROUND(COALESCE(total_time_minutes, 0))
  ORDER BY 
    CASE activity_source
      WHEN 'garmin' THEN 1
      WHEN 'polar' THEN 2
      WHEN 'healthkit' THEN 3
      WHEN 'strava' THEN 4
      ELSE 5
    END,
    created_at ASC
) = 1
```

### 2. Edge Function `refresh-deduplicada-subscribers`

- Chama a RPC incremental `populate_deduplicada_subscribers_incremental`
- Loga o numero de registros processados
- Retorna status de sucesso/erro

### 3. Populacao Inicial

Apos a migration, executar a RPC `populate_deduplicada_subscribers_full` via SQL Editor para popular todo o historico.

### 4. Cron Job

Agendar via `pg_cron` para rodar diariamente a meia-noite (UTC), chamando a Edge Function `refresh-deduplicada-subscribers`. O job incremental processa apenas atividades dos ultimos 2 dias, mantendo o custo computacional baixo.

## Detalhes Tecnicos

### Migration SQL

```sql
-- 1. Tabela deduplicada
CREATE TABLE IF NOT EXISTS public.all_activities_deduplicada_subscribers (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_id text,
  activity_type text,
  activity_date date,
  total_distance_meters double precision,
  total_time_minutes double precision,
  device_name text,
  active_kilocalories integer,
  average_heart_rate integer,
  max_heart_rate integer,
  pace_min_per_km double precision,
  total_elevation_gain_in_meters double precision,
  total_elevation_loss_in_meters double precision,
  activity_source text,
  created_at timestamptz,
  updated_at timestamptz,
  detected_workout_type text
);

CREATE INDEX idx_dedup_sub_user_date 
  ON all_activities_deduplicada_subscribers(user_id, activity_date);
CREATE INDEX idx_dedup_sub_source 
  ON all_activities_deduplicada_subscribers(activity_source);
CREATE INDEX idx_dedup_sub_created 
  ON all_activities_deduplicada_subscribers(created_at);

-- 2. RPC full rebuild
CREATE OR REPLACE FUNCTION populate_deduplicada_subscribers_full()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  TRUNCATE public.all_activities_deduplicada_subscribers;
  
  INSERT INTO public.all_activities_deduplicada_subscribers
  SELECT a.id, a.user_id, a.activity_id, a.activity_type, a.activity_date,
         a.total_distance_meters, a.total_time_minutes, a.device_name,
         a.active_kilocalories, a.average_heart_rate, a.max_heart_rate,
         a.pace_min_per_km, a.total_elevation_gain_in_meters,
         a.total_elevation_loss_in_meters, a.activity_source,
         a.created_at, a.updated_at, a.detected_workout_type
  FROM (
    SELECT *, ROW_NUMBER() OVER (
      PARTITION BY aa.user_id, aa.activity_date, 
                   ROUND(COALESCE(aa.total_time_minutes, 0))
      ORDER BY 
        CASE aa.activity_source
          WHEN 'garmin' THEN 1
          WHEN 'polar' THEN 2
          WHEN 'healthkit' THEN 3
          WHEN 'strava' THEN 4
          ELSE 5
        END,
        aa.created_at ASC
    ) as rn
    FROM public.all_activities aa
    JOIN public.subscribers s ON aa.user_id = s.user_id AND s.subscribed = true
  ) a
  WHERE a.rn = 1;
END;
$$;

-- 3. RPC incremental (ultimos 2 dias)
CREATE OR REPLACE FUNCTION populate_deduplicada_subscribers_incremental()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  affected_rows integer;
BEGIN
  -- Remove registros recentes dos usuarios afetados
  DELETE FROM public.all_activities_deduplicada_subscribers d
  WHERE d.user_id IN (
    SELECT DISTINCT aa.user_id 
    FROM public.all_activities aa
    WHERE aa.created_at >= NOW() - INTERVAL '2 days'
  )
  AND d.activity_date >= (CURRENT_DATE - INTERVAL '2 days');

  -- Reinsere de forma deduplicada
  INSERT INTO public.all_activities_deduplicada_subscribers
  SELECT a.id, a.user_id, a.activity_id, a.activity_type, a.activity_date,
         a.total_distance_meters, a.total_time_minutes, a.device_name,
         a.active_kilocalories, a.average_heart_rate, a.max_heart_rate,
         a.pace_min_per_km, a.total_elevation_gain_in_meters,
         a.total_elevation_loss_in_meters, a.activity_source,
         a.created_at, a.updated_at, a.detected_workout_type
  FROM (
    SELECT *, ROW_NUMBER() OVER (
      PARTITION BY aa.user_id, aa.activity_date, 
                   ROUND(COALESCE(aa.total_time_minutes, 0))
      ORDER BY 
        CASE aa.activity_source
          WHEN 'garmin' THEN 1
          WHEN 'polar' THEN 2
          WHEN 'healthkit' THEN 3
          WHEN 'strava' THEN 4
          ELSE 5
        END,
        aa.created_at ASC
    ) as rn
    FROM public.all_activities aa
    JOIN public.subscribers s ON aa.user_id = s.user_id AND s.subscribed = true
    WHERE aa.user_id IN (
      SELECT DISTINCT a2.user_id 
      FROM public.all_activities a2
      WHERE a2.created_at >= NOW() - INTERVAL '2 days'
    )
    AND aa.activity_date >= (CURRENT_DATE - INTERVAL '2 days')
  ) a
  WHERE a.rn = 1
  ON CONFLICT (id) DO UPDATE SET
    activity_type = EXCLUDED.activity_type,
    total_distance_meters = EXCLUDED.total_distance_meters,
    total_time_minutes = EXCLUDED.total_time_minutes,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

-- 4. Permissoes
REVOKE ALL ON FUNCTION populate_deduplicada_subscribers_full() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION populate_deduplicada_subscribers_full() TO service_role;

REVOKE ALL ON FUNCTION populate_deduplicada_subscribers_incremental() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION populate_deduplicada_subscribers_incremental() TO service_role;

-- 5. RLS
ALTER TABLE all_activities_deduplicada_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dedup activities"
  ON all_activities_deduplicada_subscribers FOR SELECT
  USING (auth.uid() = user_id);
```

### Edge Function `refresh-deduplicada-subscribers/index.ts`

Chama `supabase.rpc("populate_deduplicada_subscribers_incremental")` e retorna o resultado.

### Cron Job (via SQL Editor apos deploy)

```sql
SELECT cron.schedule(
  'refresh-deduplicada-subscribers-midnight',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url:='https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/refresh-deduplicada-subscribers',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
```

### Populacao Inicial (via SQL Editor)

Apos a migration ser aplicada, executar:
```sql
SELECT populate_deduplicada_subscribers_full();
```

## Resumo de Impacto

- **~6.959 atividades duplicadas** serao eliminadas
- **140 usuarios dual-source** terao historico limpo
- Cron incremental processa apenas ultimas 48h, custo computacional minimo
- Dados Garmin priorizados por terem tipagem mais granular (ex: TREADMILL_RUNNING vs Run)
