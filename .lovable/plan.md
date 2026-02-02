

# Plano de Correção: Volume Semanal e Títulos de Easy Runs

## Diagnóstico dos 3 Problemas

### Problema 1: Volume Semanal Baixo (41 km/sem vs 70-80 km esperado)

| Semana | Volume Atual | Volume Ideal |
|--------|--------------|--------------|
| Semana 22 (pico) | 41 km | 70-80 km |
| Média geral | 28 km | 50-60 km |

**Causas identificadas:**

1. **`LEVEL_CONFIGS['Beginner'].maxWeeklyKm = 50`** - O cap máximo para iniciantes está muito baixo para maratona
2. **`generateEasyRun()` linha 1420** - A fórmula `(baseDistance + week * 0.3) * vol` resulta em easy runs de apenas 3-5km
3. **Cap de volume semanal (linha 1153)** - O código corta os easy runs quando atinge o limite semanal

### Problema 2: Títulos Inconsistentes

**Exemplo real do banco:**
- Título: `"Corrida Leve 7km"` 
- Distância real: `3509 metros` (3.5km)

**Causa:** A função `generateEasyRun()` cria o título ANTES do ajuste de volume na linha 1155:
```typescript
// Problema: título já definido com distance original
title: `Corrida Leve ${distance}km`,  // distance = 7km

// Depois, na linha 1155, o código reduz:
easySession.distance_km = sessionKm;  // sessionKm = 3.5km
// Mas o título permanece "7km"!
```

### Problema 3: Volume Total de 561 km (inadequado para sub-4:30)

Para uma maratona sub-4:30, o volume ideal é:
- **Total do plano:** 800-1000 km
- **Volume atual:** 561 km (30% abaixo)

---

## Solução em 4 Correções

### Correção 1: Aumentar Caps de Volume para Maratona

```typescript
// ANTES
const LEVEL_CONFIGS: Record<string, AthleteLevelConfig> = {
  'Beginner': { maxWeeklyKm: 50, maxLongRunKm: 25, maxEasyRunKm: 10, ... },
  ...
};

// DEPOIS - Aumentar para suportar maratona
const LEVEL_CONFIGS: Record<string, AthleteLevelConfig> = {
  'Beginner': { maxWeeklyKm: 60, maxLongRunKm: 30, maxEasyRunKm: 14, ... },
  'Intermediate': { maxWeeklyKm: 85, maxLongRunKm: 35, maxEasyRunKm: 18, ... },
  'Advanced': { maxWeeklyKm: 100, maxLongRunKm: 38, maxEasyRunKm: 22, ... },
  'Elite': { maxWeeklyKm: 130, maxLongRunKm: 42, maxEasyRunKm: 26, ... },
};
```

### Correção 2: Aumentar Distância Base dos Easy Runs

```typescript
// ANTES (linha 1419-1420)
const baseDistance = phase === 'base' ? 5 : phase === 'build' ? 6 : phase === 'peak' ? 7 : 5;
let distance = Math.min(easyRunCap, Math.round((baseDistance + week * 0.3) * vol));

// DEPOIS - Fórmula mais agressiva baseada no objetivo
function generateEasyRun(...): WorkoutSession {
  const easyRunCap = getEasyRunCap(goal, athleteLevel);
  
  // Distância base maior para objetivos de longa distância
  const goalMultiplier = goal === '42k' ? 1.4 : goal === '21k' ? 1.2 : 1.0;
  const baseDistance = phase === 'base' ? 6 : phase === 'build' ? 8 : phase === 'peak' ? 10 : 6;
  
  // Progressão mais agressiva: 0.4 km por semana
  let distance = Math.min(easyRunCap, Math.round((baseDistance + week * 0.4) * vol * goalMultiplier));
  
  // Mínimo de 6km para maratona
  if (goal === '42k' || goal === '21k') {
    distance = Math.max(distance, phase === 'taper' ? 5 : 6);
  }
  
  // Taper: redução gradual, não abrupta
  if (phase === 'taper') {
    distance = Math.max(4, Math.round(distance * 0.7));
  }
  
  return {
    type: 'easy',
    title: `Corrida Leve ${distance}km`,  // Título correto aqui
    distance_km: distance,
    ...
  };
}
```

### Correção 3: Corrigir Título Inconsistente

O bug está no loop principal onde o easy run é gerado e depois modificado:

```typescript
// ANTES (linhas 1144-1166)
for (const dow of remainingDays) {
  const easySession = generateEasyRun(...);
  
  let sessionKm = easySession.distance_km || 6;
  if (weeklyDistanceKm + sessionKm > maxWeeklyKm) {
    sessionKm = Math.max(3, maxWeeklyKm - weeklyDistanceKm);
    easySession.distance_km = sessionKm;
    // BUG: título ainda diz o valor original!
  }
  
  workouts.push(easySession);
}

// DEPOIS - Atualizar título quando distância muda
for (const dow of remainingDays) {
  const easySession = generateEasyRun(...);
  
  let sessionKm = easySession.distance_km || 6;
  if (weeklyDistanceKm + sessionKm > maxWeeklyKm) {
    sessionKm = Math.max(3, maxWeeklyKm - weeklyDistanceKm);
    easySession.distance_km = sessionKm;
    // FIX: Atualizar o título para refletir a nova distância
    easySession.title = `Corrida Leve ${sessionKm}km`;
  }
  
  workouts.push(easySession);
}
```

### Correção 4: Volume Semanal Mínimo por Objetivo

Adicionar targets mínimos para garantir volume adequado:

```typescript
// Nova constante - Volume mínimo por fase para cada objetivo
const MIN_WEEKLY_VOLUME: Record<string, Record<string, number>> = {
  '42k': { base: 35, build: 50, peak: 65, taper: 40 },
  '21k': { base: 30, build: 45, peak: 55, taper: 35 },
  '10k': { base: 25, build: 35, peak: 45, taper: 28 },
  '5k':  { base: 20, build: 30, peak: 38, taper: 22 },
};

// No loop principal, garantir volume mínimo
const minWeeklyKm = MIN_WEEKLY_VOLUME[goal]?.[phase] || 25;

// Se volume estiver abaixo do mínimo, aumentar easy runs
if (weeklyDistanceKm < minWeeklyKm && remainingDays.length > 0) {
  const deficit = minWeeklyKm - weeklyDistanceKm;
  const extraPerRun = Math.ceil(deficit / remainingDays.length);
  // Distribuir o deficit entre os easy runs
}
```

---

## Arquivos a Modificar

| Arquivo | Modificações |
|---------|--------------|
| `supabase/functions/generate-training-plan/index.ts` | 4 correções |

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Volume pico semanal | 41 km | 70-75 km |
| Volume médio semanal | 28 km | 50-55 km |
| Volume total do plano | 561 km | 900-1000 km |
| Easy runs (base) | 3-5 km | 8-10 km |
| Easy runs (peak) | 5-7 km | 12-16 km |
| Consistência título/distância | 60% | 100% |

---

## Detalhes Técnicos

### Linhas a Modificar

1. **Linhas 118-154** - `LEVEL_CONFIGS`: Aumentar caps de volume
2. **Linhas 269-280** - `EASY_RUN_CAPS`: Já corrigido, mas verificar valores
3. **Linhas 1406-1442** - `generateEasyRun()`: Nova fórmula de cálculo
4. **Linhas 1144-1166** - Loop de easy runs: Corrigir título + garantir volume mínimo

### Validação

Após implementar, o plano de maratona de 20 semanas deverá mostrar:

```
Semana 1 (Base):    Longão 10km + Quality + 2x Easy 8km  = ~30km
Semana 10 (Build):  Longão 25km + 2x Quality + Easy 12km = ~55km  
Semana 15 (Peak):   Longão 32km + 2x Quality + Easy 14km = ~70km
Semana 18 (Taper):  Longão 20km + Quality + Easy 8km     = ~40km
```

