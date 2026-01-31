
# Correção: Gráfico de Evolução de Ritmo para Atividades HealthKit sem Dados de Distância por Intervalo

## Diagnóstico Completo

### Problema Identificado

A atividade `2900C1F1-4FF1-4501-A3FB-2DBE840485C4` (HealthKit) mostra no gráfico:
- **Pace exibido**: ~8:14/km (linha praticamente reta)
- **Pace real**: 5:52/km (5.86 min/km)
- **Distância máxima no gráfico**: 4.3km
- **Distância real**: 6.05km

### Causa Raiz

O HealthKit envia 3 tipos de séries temporais, mas **nem todas estão presentes em toda atividade**:

| Série | Disponível | Quantidade |
|-------|------------|------------|
| `energy` (calorias) | ✅ Sim | 827 amostras |
| `heartRate` (FC) | ✅ Sim | 426 amostras |
| `distances` (distância por intervalo) | ❌ Não | 0 amostras |

Quando **não há dados de `distances`**, o algoritmo atual tenta **estimar velocidade usando energia**, o que é incorreto:

```text
Lógica atual (incorreta):
  energia alta → velocidade alta
  energia baixa → velocidade baixa
  
Problema: energia não correlaciona diretamente com velocidade
          (subir ladeira = mais energia, menor velocidade)
```

### Por que 826 pontos têm pace ~8.2 min/km?

O algoritmo calcula:
1. `baseSpeed = totalDistance / totalDuration` = 6049m / 2128s = **2.84 m/s**
2. `speedMultiplier = 0.7 + (normalizedEnergy * 0.8)` → varia de 0.7 a 1.5
3. Como a energia é relativamente uniforme, quase todos multiplicadores ficam próximos de **0.7**
4. `speed = 2.84 * 0.7 = ~2.0 m/s` → equivale a **~8.3 min/km**

## Solução Proposta

### Abordagem: Usar Distância Linear Interpolada

Quando não há dados de `distances`, a melhor abordagem é **assumir velocidade constante** (pace médio) e interpolar a distância linearmente. Isso é mais preciso do que tentar estimar usando energia.

### Alterações no Código

#### Arquivo: `supabase/functions/calculate-activity-chart-data/index.ts`

Modificar a seção de processamento HealthKit (linhas ~274-370):

```text
ANTES:
  - Calcular velocidade baseada em energia (speedMultiplier = 0.7-1.5)
  - Somar distâncias cumulativas baseadas em estimativas

DEPOIS:
  1. Verificar se existem dados de `distances` no raw_data
  2. SE existirem: usar distâncias reais para calcular velocidade
  3. SE NÃO existirem:
     a. Calcular velocidade média: avgSpeed = totalDistance / totalDuration
     b. Interpolar distância linearmente ao longo do tempo
     c. Usar avgSpeed como velocidade para todos os pontos
     d. Resultado: gráfico mostra pace médio real (5:52/km) consistentemente
```

### Código da Solução

1. **Adicionar verificação de dados de distância**:
```typescript
// Check if we have actual distance samples from HealthKit
const distanceSamples = healthkitActivity.raw_data.distances || [];
const hasDistanceData = distanceSamples.length > 0;
```

2. **Se houver dados de distância, usar diretamente**:
```typescript
if (hasDistanceData) {
  // Use actual distance samples for accurate pace calculation
  rows = distanceSamples.map((distPoint, index) => {
    const timestamp = new Date(distPoint.timestamp).getTime() / 1000;
    const distance = distPoint.value; // cumulative distance
    const relativeTime = timestamp - activityStartTime;
    
    // Calculate speed from consecutive distance points
    let speed = avgSpeed;
    if (index > 0) {
      const prevDist = distanceSamples[index - 1].value;
      const prevTime = new Date(distanceSamples[index - 1].timestamp).getTime() / 1000;
      const deltaD = distance - prevDist;
      const deltaT = timestamp - prevTime;
      if (deltaT > 0) speed = deltaD / deltaT;
    }
    
    return {
      sample_timestamp: timestamp,
      timer_duration_in_seconds: relativeTime,
      heart_rate: interpolateHeartRate(timestamp),
      total_distance_in_meters: distance,
      speed_meters_per_second: speed,
    };
  });
}
```

3. **Se NÃO houver dados de distância, usar interpolação linear**:
```typescript
else {
  // No distance data - use linear interpolation with average speed
  const avgSpeed = totalDistance / totalDuration;
  
  rows = primaryData.map((point, index) => {
    const timestamp = new Date(point.timestamp).getTime() / 1000;
    const relativeTime = timestamp - activityStartTime;
    
    // Linear interpolation of distance based on time
    const progressRatio = Math.min(1, relativeTime / totalDuration);
    const interpolatedDistance = totalDistance * progressRatio;
    
    return {
      sample_timestamp: timestamp,
      timer_duration_in_seconds: relativeTime,
      heart_rate: energyData.length > 0 ? interpolateHeartRate(timestamp) : point.value,
      total_distance_in_meters: interpolatedDistance,
      speed_meters_per_second: avgSpeed, // Consistent average speed
    };
  });
}
```

### Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Pace no gráfico | ~8:14/km (incorreto) | ~5:52/km (correto) |
| Distância máxima | ~4.3km | 6.05km |
| Forma da linha FC | ✅ Correta | ✅ Mantida |
| Forma da linha Pace | Reta incorreta | Reta com pace real |

### Consideração sobre Variação de Pace

Com a solução de interpolação linear, o gráfico mostrará uma **linha reta de pace** (velocidade constante). Isso é correto quando:
- Não temos dados de GPS
- Não temos dados de distância por intervalo

A alternativa seria tentar estimar variação de velocidade usando FC ou energia, mas isso introduz mais erro do que valor. É preferível mostrar o pace médio real do que um pace variável incorreto.

### Opção Futura: Usar GPS se Disponível

Se a atividade tiver dados de `locationSamples` (GPS), podemos calcular velocidade real entre pontos:
```typescript
// Future enhancement: calculate speed from GPS points
const locationSamples = healthkitActivity.raw_data.locationSamples || [];
if (locationSamples.length > 1) {
  // Calculate distance between consecutive GPS points using Haversine formula
  // This would give pace variation real
}
```

## Arquivos Afetados

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `supabase/functions/calculate-activity-chart-data/index.ts` | Modificar lógica de processamento HealthKit |

## Ação Adicional Necessária

Após o deploy da correção, será necessário **reprocessar** a atividade:
```sql
DELETE FROM activity_chart_data 
WHERE activity_id = '2900C1F1-4FF1-4501-A3FB-2DBE840485C4';
```
E então forçar o recálculo acessando a página de detalhes da atividade.

## Resumo

O problema ocorre porque o HealthKit não enviou dados de distância por intervalo para esta atividade, e o algoritmo atual tenta estimar velocidade usando energia - o que resulta em valores incorretos. A solução é usar **interpolação linear** da distância total quando não houver dados granulares, garantindo que o pace médio exibido corresponda ao pace real da atividade.
