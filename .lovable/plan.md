

# Correção: Limite de 1000 Registros na Edge Function

## Problema Identificado

A Edge Function `calculate-average-pace` está limitada pelo **default row limit de 1000** do Supabase, resultando em cálculos incorretos:

| Métrica | Valor Calculado | Valor Real |
|---------|-----------------|------------|
| RUNNING activities | 526 | **8.581** |
| CYCLING activities | 285 | ~4.000+ |
| SWIMMING activities | 14 | ~100+ |
| Total processado | ~1.000 | **16.769** |

## Solução

Implementar **paginação** na Edge Function para buscar todos os registros, ou usar uma **abordagem de agregação via RPC** no banco de dados.

### Opção Recomendada: Agregação via SQL (mais eficiente)

Criar uma função SQL que faz a agregação diretamente no banco, eliminando a necessidade de transferir 16.000+ registros para a Edge Function:

```sql
CREATE OR REPLACE FUNCTION calculate_average_pace_aggregation(
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  category TEXT,
  total_distance DOUBLE PRECISION,
  total_time DOUBLE PRECISION,
  activity_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
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
  WHERE activity_date >= p_period_start
    AND activity_date <= p_period_end
    AND total_distance_meters > 0
    AND total_time_minutes > 0
  GROUP BY 1
  HAVING CASE 
    WHEN UPPER(activity_type) IN (...) THEN 'CYCLING'
    ...
  END IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Modificações na Edge Function

1. Remover a busca de todos os registros
2. Chamar a função RPC `calculate_average_pace_aggregation`
3. Processar apenas 3 registros (um por categoria)

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar função `calculate_average_pace_aggregation` |
| `supabase/functions/calculate-average-pace/index.ts` | Usar RPC ao invés de fetch + loop |

## Benefícios

- **Performance**: Agregação no banco (0 transferência de 16k registros)
- **Precisão**: 100% das atividades processadas
- **Escalabilidade**: Funciona mesmo com milhões de registros

## Detalhes Técnicos

### Edge Function Modificada (resumo):

```typescript
// Antes: buscar 16k+ registros e agregar em JavaScript
const { data: activities } = await supabase
  .from("all_activities")
  .select("*")  // PROBLEMA: limite de 1000

// Depois: chamar RPC que retorna apenas 3 registros agregados
const { data: aggregated } = await supabase
  .rpc("calculate_average_pace_aggregation", {
    p_period_start: periodStart,
    p_period_end: periodEnd
  });
```

## Resultado Esperado

Após a correção, a tabela `average_pace` terá:

| category | total_activities | status |
|----------|------------------|--------|
| RUNNING | 8.581 | ✅ Correto |
| CYCLING | ~4.000 | ✅ Correto |
| SWIMMING | ~100 | ✅ Correto |

