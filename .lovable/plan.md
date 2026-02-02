
# Plano de Correção: Planos de Corrida Fracos

## Diagnóstico Confirmado

Após análise do plano `4c89cc8d-e9cb-4ac7-8230-ff57c4136036`, identifiquei **5 problemas críticos** que explicam por que os usuários reclamam que os planos estão "fracos":

| Problema | Impacto | Linha do Código |
|----------|---------|-----------------|
| Fase Base bloqueia TODA qualidade | 8 semanas sem treinos intensos | 1203 |
| Volume semanal muito baixo | 29 km/sem vs 70 km esperado | 1027-1033 |
| Longão máximo em 22km | Deveria ser 32-35km para maratona | 1031-1032 |
| Zero intervalados para 42k | Falta de estímulo VO2max | 1209-1272 |
| Progressão de paces inexistente | Easy runs estáticos em 6:70/km | 1117-1170 |

---

## Solução Técnica: 5 Correções

### Correção 1: Permitir Qualidade na Fase Base (Fartlek Leve)

**Arquivo:** `supabase/functions/generate-training-plan/index.ts`

**Problema:** Linha 1203 bloqueia TUDO na fase base:
```typescript
const shouldAddQuality = phase !== 'base' && phase !== 'taper' && isQualityDay;
```

**Solução:** Permitir treinos de qualidade LEVE na fase base (fartlek, strides):
```typescript
// Base phase: allow gentle quality (fartlek, strides) but not intervals
const isBasePhase = phase === 'base';
const isTaperPhase = phase === 'taper';
const shouldAddQuality = !isTaperPhase && isQualityDay && (
  !isBasePhase || (isBasePhase && week >= 3 && weeklyQualityCount < 1)
);
```

### Correção 2: Aumentar Volume Semanal para Maratona

**Problema:** Linhas 1027-1033 limitam demais o volume para iniciantes:
```typescript
if (calibrator.trainingVolume.avgWeeklyKm <= 15) {
  dist = Math.min(maxLongRun, 10 + (week - 1) * 1.0);
  dist = Math.min(28, dist);  // Cap muito baixo!
}
```

**Solução:** Progressão mais agressiva baseada na distância do objetivo:
```typescript
if (calibrator.trainingVolume.avgWeeklyKm <= 15) {
  // BEGINNER 42K: Progressão gradual mas adequada
  // Semana 1: 10km, Semana 10: 20km, Semana 18: 32km
  const progressionRate = goal === '42k' ? 1.3 : 1.0;
  dist = Math.min(maxLongRun, 10 + (week - 1) * progressionRate);
  // Permitir até 32km para iniciantes em maratona (últimas 4 semanas antes do taper)
  const beginnerCap = phase === 'peak' ? 32 : 28;
  dist = Math.min(beginnerCap, dist);
}
```

### Correção 3: Adicionar Intervalados para 42k/21k

**Problema:** O case `42k` (linhas 1209-1272) não inclui intervalados - só tempo, MP blocks, progressivo e fartlek.

**Solução:** Adicionar intervalados de 1km e 800m ao ciclo de qualidade:
```typescript
if (goal === '42k' || goal === '21k') {
  // Expand cycle to 7 workout types (was 5)
  const qualityType = week % 7;
  
  switch (qualityType) {
    case 0: // Tempo
    case 1: // MP Blocks  
    case 2: // Intervals 1km (NEW!)
      type = 'interval';
      const reps1k = getIntervalReps(1000, week, totalWeeks, athleteLevel);
      title = `${reps1k}x1km`;
      description = `Aquecimento + ${reps1k}x1km ritmo 10k, rec 2min`;
      duration_min = 30 + reps1k * 2;
      pace = paces.pace_interval_1km;
      zone = 4;
      intensity = 'high';
      break;
    case 3: // Progressivo
    case 4: // Fartlek
    case 5: // Intervals 800m (NEW!)
      type = 'interval';
      const reps800 = getIntervalReps(800, week, totalWeeks, athleteLevel);
      title = `${reps800}x800m`;
      description = `Aquecimento + ${reps800}x800m ritmo 5-10k, rec 90s`;
      duration_min = 30 + reps800 * 1.5;
      pace = paces.pace_interval_800m;
      zone = 4;
      intensity = 'high';
      break;
    case 6: // Threshold Run (NEW!)
      type = 'threshold';
      title = 'Threshold 3x10min';
      description = 'Aquecimento + 3x10min @ limiar, rec 3min';
      duration_min = 45;
      pace = paces.pace_tempo - 0.2;
      zone = 4;
      intensity = 'high';
      break;
  }
}
```

### Correção 4: Aumentar Longão Máximo

**Problema:** `maxLongRunKm` muito conservador para maratona.

**Arquivo:** Função `getAthleteLevelConfig` (linhas 165-174)

**Solução:** Ajustar caps por objetivo:
```typescript
// Current: maxLongRunKm: 25-40 based on level
// New: Add goal-specific overrides
const GOAL_LONG_RUN_CAPS: Record<string, number> = {
  '5k': 14,
  '10k': 18,
  '21k': 26,
  '42k': 36,  // Was effectively 28 for beginners
};

function getMaxLongRunForGoal(level: string, goal: string, currentLongest: number): number {
  const levelConfig = getAthleteLevelConfig(level, goal);
  const goalCap = GOAL_LONG_RUN_CAPS[goal] || 20;
  
  // Para maratona, permitir progressão até 36km independente do nível
  if (goal === '42k') {
    return Math.min(36, Math.max(currentLongest * 1.5, levelConfig.maxLongRunKm));
  }
  
  return Math.min(goalCap, levelConfig.maxLongRunKm);
}
```

### Correção 5: Progressão de Volume Semanal Mais Agressiva

**Problema:** O volume semanal não cresce adequadamente ao longo do plano.

**Solução:** Criar função de progressão de volume baseada na fase:
```typescript
function getWeeklyVolumeTarget(
  week: number, 
  totalWeeks: number, 
  phase: string, 
  goal: string,
  currentVolume: number,
  maxVolume: number
): number {
  const phaseMultipliers = {
    'base': { start: 0.6, end: 0.75 },
    'build': { start: 0.75, end: 0.95 },
    'peak': { start: 0.95, end: 1.0 },
    'taper': { start: 0.7, end: 0.5 },
  };
  
  const multiplier = phaseMultipliers[phase] || phaseMultipliers['build'];
  const phaseProgress = getPhaseProgress(week, totalWeeks, phase);
  const targetMultiplier = multiplier.start + (multiplier.end - multiplier.start) * phaseProgress;
  
  // Start from current volume + 20%, progress to max
  const startVolume = Math.max(currentVolume * 1.2, 25);
  const targetVolume = startVolume + (maxVolume - startVolume) * (week / totalWeeks);
  
  return Math.round(targetVolume * targetMultiplier);
}
```

---

## Arquivos a Modificar

| Arquivo | Alterações | Linhas Afetadas |
|---------|------------|-----------------|
| `supabase/functions/generate-training-plan/index.ts` | 5 correções | ~1200-1280, ~1027-1044, ~165-174 |

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Treinos de qualidade na Base | 0 | 4-6 (fartlek/strides) |
| Intervalados totais | 0 | 8-12 |
| Volume semanal pico | 33 km | 65-75 km |
| Longão máximo | 22 km | 32-35 km |
| Diversidade de treinos | 6 tipos | 10+ tipos |

---

## Validação do Usuário

Após implementar, o plano do Sandro deverá ter:
- Semanas 3-4 (Base): Fartlek leve + strides
- Semanas 9-14 (Build): 2x qualidade/semana (intervalados + tempo)
- Semanas 15-17 (Peak): Intervalados mais curtos + MP blocks
- Longões: 10km → 16km → 22km → 28km → 32km → 35km
- Volume: 25km → 45km → 65km → 75km → 50km (taper)
