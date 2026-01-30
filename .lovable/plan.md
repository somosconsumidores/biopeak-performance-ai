

# Plano: Cron Job para Cálculo de Pace Médio por Modalidade

## Visão Geral

Criar um sistema automatizado que calcula e armazena o pace médio das atividades dos últimos 30 dias, agrupadas por modalidade (RUNNING, CYCLING, SWIMMING), executando diariamente à meia-noite.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          pg_cron (00:00 UTC)                        │
│                                 │                                   │
│                                 ▼                                   │
│              HTTP POST → Edge Function                              │
│                                 │                                   │
│                                 ▼                                   │
│                    calculate-average-pace                           │
│                                 │                                   │
│    ┌────────────────────────────┼────────────────────────────────┐  │
│    ▼                            ▼                                ▼  │
│ RUNNING                     CYCLING                         SWIMMING│
│ (min/km)                    (km/h)                        (min/100m)│
│    │                            │                                │  │
│    └────────────────────────────┼────────────────────────────────┘  │
│                                 ▼                                   │
│                        Tabela: average_pace                         │
│                    (histórico diário por categoria)                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Estrutura da Tabela `average_pace`

### Colunas:
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único |
| `calculated_at` | TIMESTAMPTZ | Momento do cálculo |
| `period_start` | DATE | Início do período (30 dias antes) |
| `period_end` | DATE | Fim do período (data do cálculo) |
| `category` | TEXT | RUNNING, CYCLING ou SWIMMING |
| `average_pace_value` | DOUBLE PRECISION | Valor calculado |
| `pace_unit` | TEXT | Unidade (min/km, km/h, min/100m) |
| `total_activities` | INTEGER | Quantidade de atividades consideradas |
| `total_distance_meters` | DOUBLE PRECISION | Distância total agregada |
| `total_time_minutes` | DOUBLE PRECISION | Tempo total agregado |

### Índices:
- Índice composto em `(calculated_at, category)` para consultas rápidas do histórico

---

## 2. Mapeamento de Tipos de Atividade

### CYCLING (→ km/h)
```text
Ride, CYCLING, ROAD_BIKING, VirtualRide, MOUNTAIN_BIKING, 
INDOOR_CYCLING, VIRTUAL_RIDE, EBikeRide, Velomobile
```

### RUNNING (→ min/km)
```text
Run, RUNNING, TREADMILL_RUNNING, INDOOR_CARDIO, TRAIL_RUNNING, 
VirtualRun, TRACK_RUNNING, VIRTUAL_RUN, INDOOR_RUNNING, ULTRA_RUN, free_run
```

### SWIMMING (→ min/100m)
```text
Swim, LAP_SWIMMING, OPEN_WATER_SWIMMING, SWIMMING
```

---

## 3. Edge Function: `calculate-average-pace`

### Lógica de Cálculo:

**Para RUNNING:**
```text
Pace (min/km) = Total de Minutos ÷ (Total de Metros ÷ 1000)
```

**Para CYCLING:**
```text
Velocidade (km/h) = (Total de Metros ÷ 1000) ÷ (Total de Minutos ÷ 60)
```

**Para SWIMMING:**
```text
Pace (min/100m) = Total de Minutos ÷ (Total de Metros ÷ 100)
```

### Fluxo:
1. Buscar atividades dos últimos 30 dias com `total_distance_meters > 0` e `total_time_minutes > 0`
2. Agrupar por categoria usando `CASE WHEN` no SQL
3. Calcular totais agregados (distância e tempo)
4. Aplicar fórmula específica por categoria
5. Inserir registros na tabela `average_pace`

---

## 4. Cron Job: `calculate-average-pace-midnight`

- **Schedule:** `0 0 * * *` (meia-noite UTC todos os dias)
- **Padrão:** Segue o mesmo modelo de `refresh-materialized-views-midnight`
- **Endpoint:** `POST /functions/v1/calculate-average-pace`

---

## 5. Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/calculate-average-pace/index.ts` | **Criar** - Edge Function principal |
| `supabase/config.toml` | **Modificar** - Adicionar configuração da função |
| Migration SQL | **Criar** - Tabela + cron job |

---

## Detalhes Técnicos

### Query SQL de Agregação:
```sql
SELECT 
  CASE 
    WHEN UPPER(activity_type) IN ('RIDE','CYCLING','ROAD_BIKING','VIRTUALRIDE','MOUNTAIN_BIKING','INDOOR_CYCLING','VIRTUAL_RIDE','EBIKERIDE','VELOMOBILE') 
    THEN 'CYCLING'
    WHEN UPPER(activity_type) IN ('RUN','RUNNING','TREADMILL_RUNNING','INDOOR_CARDIO','TRAIL_RUNNING','VIRTUALRUN','TRACK_RUNNING','VIRTUAL_RUN','INDOOR_RUNNING','ULTRA_RUN','FREE_RUN') 
    THEN 'RUNNING'
    WHEN UPPER(activity_type) IN ('SWIM','LAP_SWIMMING','OPEN_WATER_SWIMMING','SWIMMING') 
    THEN 'SWIMMING'
  END as category,
  SUM(total_distance_meters) as total_distance,
  SUM(total_time_minutes) as total_time,
  COUNT(*) as activity_count
FROM all_activities
WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days'
  AND activity_date <= CURRENT_DATE
  AND total_distance_meters > 0
  AND total_time_minutes > 0
GROUP BY category
HAVING category IS NOT NULL
```

### Segurança:
- RLS habilitado na tabela `average_pace`
- Acesso público de leitura (dados agregados sem PII)
- Apenas `service_role` pode inserir

### Configuração da Edge Function:
```toml
[functions.calculate-average-pace]
verify_jwt = false
```

---

## Resultado Esperado

Após a implementação, a tabela `average_pace` armazenará registros diários como:

| calculated_at | category | average_pace_value | pace_unit | total_activities |
|---------------|----------|-------------------|-----------|------------------|
| 2026-01-31 00:00:00 | RUNNING | 5.42 | min/km | 8.214 |
| 2026-01-31 00:00:00 | CYCLING | 28.5 | km/h | 5.171 |
| 2026-01-31 00:00:00 | SWIMMING | 2.15 | min/100m | 625 |

Isso permite:
- Análise de tendências históricas
- Comparação de evolução entre períodos
- Insights para o AI Coach sobre médias da plataforma

