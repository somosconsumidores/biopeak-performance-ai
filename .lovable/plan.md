

# Plano: Card "Meus Recordes Pessoais" na Página Evolução

## Resumo
Criar um sistema de ranking top 3 por modalidade esportiva (Corrida, Ciclismo, Natação), com cálculo diário via cron job exclusivo para assinantes, armazenando os dados em tabela dedicada para leitura instantânea no frontend.

## Arquitetura

### Fluxo de Dados
```text
+-------------------+      +-------------------------+      +----------------------+
| mv_active_        |      | calculate-personal-     |      | my_personal_records  |
| subscribers       | ---> | records (Edge Function) | ---> | (tabela pré-calc)    |
+-------------------+      +-------------------------+      +----------------------+
                                     |                              |
                                     v                              v
                           +-------------------+           +------------------+
                           | all_activities +  |           | Frontend (leitura|
                           | activity_best_    |           | instantânea)     |
                           | segments          |           +------------------+
                           +-------------------+
```

## Componentes

### 1. Nova Tabela: `my_personal_records`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| category | text | RUNNING, CYCLING, SWIMMING |
| rank_position | int | 1, 2 ou 3 |
| activity_id | text | ID da atividade fonte |
| activity_date | date | Data da atividade |
| best_pace_value | numeric | Valor bruto do pace |
| formatted_pace | text | Pace formatado (5:35/km, 32.5 km/h, 2:15/100m) |
| activity_source | text | garmin, strava, polar, etc. |
| calculated_at | timestamptz | Quando foi calculado |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2. Nova RPC: `calculate_personal_records_for_subscribers`
Lógica SQL otimizada no banco para:
1. Iterar sobre assinantes ativos (via `mv_active_subscribers`)
2. Fazer JOIN entre `activity_best_segments` e `all_activities` para obter o `activity_type`
3. Agrupar por categoria usando os mapeamentos fornecidos
4. Selecionar top 3 por categoria (menor pace = melhor)
5. Converter pace para unidade correta por esporte
6. Fazer UPSERT na tabela `my_personal_records`

### 3. Nova Edge Function: `calculate-personal-records`
- Chamada pelo cron job diário
- Invoca a RPC que processa todos os assinantes
- Logs de acompanhamento

### 4. Cron Job
Schedule: Diário às 01:00 UTC (para não competir com outros jobs à meia-noite)

### 5. Novos Componentes Frontend

| Componente | Responsabilidade |
|------------|------------------|
| `src/hooks/usePersonalRecords.ts` | Hook para buscar recordes do usuário |
| `src/components/evolution/PersonalRecordsCarousel.tsx` | Container com carrossel |
| `src/components/evolution/PersonalRecordCard.tsx` | Card individual por esporte |

## Agrupamento de Esportes

```text
SWIMMING:
  Swim, LAP_SWIMMING, OPEN_WATER_SWIMMING, SWIMMING

RUNNING:
  Run, RUNNING, TREADMILL_RUNNING, INDOOR_CARDIO, TRAIL_RUNNING, 
  VirtualRun, TRACK_RUNNING, VIRTUAL_RUN, INDOOR_RUNNING, ULTRA_RUN

CYCLING:
  Ride, CYCLING, ROAD_BIKING, VirtualRide, MOUNTAIN_BIKING, 
  INDOOR_CYCLING, VIRTUAL_RIDE, EBikeRide, Velomobile
```

## Formatação de Pace por Esporte

| Esporte | Unidade | Exemplo | Fórmula |
|---------|---------|---------|---------|
| Corrida | min/km | 5:35/km | pace direto do best_1km_pace_min_km |
| Ciclismo | km/h | 32.5 km/h | 60 / pace_min_km |
| Natação | min/100m | 2:15/100m | pace_min_km / 10 |

## UI/UX

### Layout Desktop (md+)
```text
+-------------+  +-------------+  +-------------+
|  🏃 Corrida |  |  🚴 Ciclismo |  |  🏊 Natação  |
|  Top 3 PRs  |  |  Top 3 PRs   |  |  Top 3 PRs   |
+-------------+  +-------------+  +-------------+
```

### Layout Mobile (Native - Carrossel)
```text
<- [🏃 Corrida] [🚴 Ciclismo] [🏊 Natação] ->
   (swipe horizontal entre cards)
```

### Design do Card
- Ícone do esporte + título
- Lista com 3 recordes:
  - 🥇 1º lugar: Data + Pace formatado
  - 🥈 2º lugar: Data + Pace formatado
  - 🥉 3º lugar: Data + Pace formatado
- Estado vazio se não houver dados para aquele esporte

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/XXXX_create_my_personal_records.sql` | Criar tabela + RLS |
| `supabase/migrations/XXXX_rpc_calculate_personal_records.sql` | Criar RPC |
| `supabase/functions/calculate-personal-records/index.ts` | Nova Edge Function |
| `src/hooks/usePersonalRecords.ts` | Novo hook |
| `src/components/evolution/PersonalRecordCard.tsx` | Novo componente |
| `src/components/evolution/PersonalRecordsCarousel.tsx` | Novo componente |
| `src/pages/Evolution.tsx` | Adicionar carrossel após CoachAnalysisCard |
| `src/lib/cache.ts` | Adicionar CACHE_KEY para recordes |

## Detalhes Técnicos

### RPC - Lógica SQL Core
```sql
-- Categorização de activity_type
CASE 
  WHEN UPPER(aa.activity_type) IN ('SWIM','LAP_SWIMMING','OPEN_WATER_SWIMMING','SWIMMING') 
    THEN 'SWIMMING'
  WHEN UPPER(aa.activity_type) IN ('RUN','RUNNING','TREADMILL_RUNNING','INDOOR_CARDIO',
    'TRAIL_RUNNING','VIRTUALRUN','TRACK_RUNNING','VIRTUAL_RUN','INDOOR_RUNNING','ULTRA_RUN') 
    THEN 'RUNNING'
  WHEN UPPER(aa.activity_type) IN ('RIDE','CYCLING','ROAD_BIKING','VIRTUALRIDE',
    'MOUNTAIN_BIKING','INDOOR_CYCLING','VIRTUAL_RIDE','EBIKERIDE','VELOMOBILE') 
    THEN 'CYCLING'
  ELSE NULL
END AS category

-- Top 3 por categoria usando ROW_NUMBER()
ROW_NUMBER() OVER (PARTITION BY user_id, category ORDER BY best_1km_pace_min_km ASC) as rank
```

### RLS
- INSERT/UPDATE/DELETE: Apenas `service_role`
- SELECT: `user_id = auth.uid()` para assinantes verem seus próprios dados

### Segurança
- RPC com `SECURITY DEFINER` e restrita a `service_role`
- Edge Function autenticada com service key

## Resultado Esperado
1. Assinantes têm seus top 3 recordes calculados diariamente
2. Frontend mostra instantaneamente os dados pré-calculados
3. Carrossel funciona suavemente em apps nativos
4. Desktop mostra os 3 cards lado a lado
5. Recordes são atualizados automaticamente quando novos treinos superam os anteriores

