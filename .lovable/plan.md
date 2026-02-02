
# Plano Definitivo: Correção do Gerador de Planos de Corrida

## Diagnóstico Confirmado pelos Dados

### Problemas Identificados no Plano 42K (c2bf5eb0):

| Métrica | Atual | Esperado | Gap |
|---------|-------|----------|-----|
| Treinos de Qualidade | 7 (8.8%) | 24 (30%) | -70% |
| Longões | 20 (25%) | 20 (25%) | OK |
| Easy Runs | 53 (66%) | 36 (45%) | +58% |
| Longão Máximo | 31 km | 35 km | -11% |
| Total Volume | ~400 km | ~600 km | -33% |

### Padrão Observado por Semana (plano 42k):
- Semanas 1-6 (Base): ZERO qualidade - só easy + long run
- Semanas 7-15 (Build): Apenas 1 qualidade a cada 2 semanas
- Semanas 16-20: Volume em colapso, easy runs dominantes

### Benchmark de Mercado (Running Coaches):

| Objetivo | Qualidade% | Longão% | Easy% | Intervalados/Sem |
|----------|-----------|---------|-------|------------------|
| 42k | 25-30% | 20-25% | 45-55% | 2x |
| 21k | 30-35% | 18-22% | 45-50% | 2x |
| 10k | 35-40% | 12-18% | 45-50% | 2-3x |
| 5k | 40-45% | 8-12% | 45-50% | 3x |

---

## Arquitetura da Solução

### Mudança 1: Garantir 2 Treinos de Qualidade por Semana

**Problema:** A lógica atual (`weeklyQualityCount < 2 && isQualityDay`) só marca terça e quinta como "qualityDay", mas o loop processa dias em ordem e NÃO força a inclusão de qualidade.

**Solução:** Criar um sistema de "slots de qualidade" garantidos por semana:

```typescript
// Definir slots de qualidade por objetivo e fase
const QUALITY_SLOTS_PER_WEEK: Record<string, Record<string, number>> = {
  '42k': { base: 1, build: 2, peak: 2, taper: 1 },
  '21k': { base: 1, build: 2, peak: 2, taper: 1 },
  '10k': { base: 1, build: 2, peak: 3, taper: 1 },
  '5k':  { base: 1, build: 2, peak: 3, taper: 1 },
  'condicionamento': { base: 0, build: 1, peak: 1, taper: 0 },
  'perda_de_peso':   { base: 0, build: 1, peak: 1, taper: 0 },
  'manutencao':      { base: 0, build: 1, peak: 1, taper: 0 },
  'retorno':         { base: 0, build: 0, peak: 1, taper: 0 },
  'melhorar_tempos': { base: 1, build: 2, peak: 3, taper: 1 },
};
```

### Mudança 2: Ciclo de Treinos de Qualidade Específico por Objetivo

**Problema:** O atual `week % 7` é genérico e gera repetição excessiva de tipos.

**Solução:** Ciclos específicos inspirados no código Gemini:

```typescript
const QUALITY_CYCLES: Record<string, string[]> = {
  '42k': ['tempo', 'mp_block', 'interval_1km', 'progressivo', 'fartlek', 'threshold', 'interval_800m'],
  '21k': ['tempo', 'threshold', 'interval_1km', 'progressivo', 'fartlek', 'interval_800m', 'race_pace'],
  '10k': ['tempo', 'interval_800m', 'threshold', 'fartlek', 'interval_1km', 'interval_400m'],
  '5k':  ['interval_400m', 'tempo', 'interval_1km', 'fartlek', 'threshold', 'interval_800m'],
  'melhorar_tempos': ['tempo', 'interval_800m', 'progressivo', 'fartlek', 'threshold', 'interval_1km'],
};
```

### Mudança 3: Corrigir Base Phase para Incluir Qualidade Leve

**Problema:** Linhas 1308-1314 permitem qualidade na base, mas apenas 1 por semana e só após semana 3.

**Solução:** Permitir 1 qualidade/semana na base desde a semana 2, com tipos específicos (fartlek leve, strides, hill repeats):

```typescript
const BASE_PHASE_QUALITY: string[] = ['fartlek_light', 'strides', 'hill_repeats'];

// Na base phase: forçar 1 treino leve de qualidade por semana
if (isBasePhase && week >= 2 && qualitySlotsFilled < 1) {
  const baseQualityType = BASE_PHASE_QUALITY[(week - 2) % BASE_PHASE_QUALITY.length];
  // Gerar sessão de qualidade leve
}
```

### Mudança 4: Progressão de Volume Mais Agressiva

**Problema:** Volume semanal não cresce adequadamente (max 40km vs esperado 75km para 42k).

**Solução:** Aumentar multiplicadores e criar targets mínimos por objetivo:

```typescript
const MIN_WEEKLY_VOLUME_TARGETS: Record<string, Record<string, number>> = {
  '42k': { base: 35, build: 55, peak: 70, taper: 45 },
  '21k': { base: 30, build: 45, peak: 55, taper: 35 },
  '10k': { base: 25, build: 40, peak: 50, taper: 30 },
  '5k':  { base: 20, build: 35, peak: 40, taper: 25 },
};

// Garantir que o volume semanal atinja o mínimo para o objetivo
const targetVolume = Math.max(
  calculatedVolume,
  MIN_WEEKLY_VOLUME_TARGETS[goal][phase] || 25
);
```

### Mudança 5: Longão com Progressão Real

**Problema:** Longões não aumentam de forma consistente (6km -> 31km em 15 semanas é ok, mas depois COLAPSA para 13km no taper sem motivo).

**Solução:** Criar função de progressão linear com taper controlado:

```typescript
function calculateLongRunDistance(
  week: number,
  totalWeeks: number,
  goal: string,
  phase: string,
  maxLongRun: number,
  currentLongest: number
): number {
  // Progressão linear: semana 1 = currentLongest, pico = maxLongRun (2-3 semanas antes do fim)
  const peakWeek = totalWeeks - 3; // Pico 3 semanas antes do evento
  
  if (week <= peakWeek) {
    // Progressão linear de currentLongest para maxLongRun
    const progress = week / peakWeek;
    return Math.round(currentLongest + (maxLongRun - currentLongest) * progress);
  } else {
    // Taper: redução gradual
    const taperWeeks = totalWeeks - peakWeek;
    const taperProgress = (week - peakWeek) / taperWeeks;
    const taperReduction = 0.3 + (taperProgress * 0.3); // 30% -> 60% redução
    return Math.round(maxLongRun * (1 - taperReduction));
  }
}
```

### Mudança 6: Aumentar Easy Run Caps

**Problema:** Easy runs com apenas 3-8km são insuficientes para volume total.

**Solução:** Aumentar caps de easy run por objetivo e nível:

```typescript
const EASY_RUN_CAPS: Record<string, Record<string, number>> = {
  '5k':  { 'Beginner': 10, 'Intermediate': 12, 'Advanced': 14, 'Elite': 16 },
  '10k': { 'Beginner': 12, 'Intermediate': 14, 'Advanced': 16, 'Elite': 18 },
  '21k': { 'Beginner': 14, 'Intermediate': 16, 'Advanced': 18, 'Elite': 22 },
  '42k': { 'Beginner': 16, 'Intermediate': 18, 'Advanced': 22, 'Elite': 26 }, // AUMENTADO
};
```

---

## Arquivos a Modificar

| Arquivo | Modificações |
|---------|--------------|
| `supabase/functions/generate-training-plan/index.ts` | Reescrever generateSession(), generateLongRun(), criar QUALITY_SLOTS, QUALITY_CYCLES |

---

## Estrutura do Novo Código

### Nova Função: `getQualityWorkout()`

```typescript
function getQualityWorkout(
  goal: string,
  week: number,
  phase: string,
  slotIndex: number, // 0 = primeiro treino de qualidade da semana, 1 = segundo
  paces: Paces,
  totalWeeks: number,
  athleteLevel: string
): WorkoutSession {
  const cycle = QUALITY_CYCLES[goal] || QUALITY_CYCLES['10k'];
  
  // Combinar semana e slot para variar os treinos
  const workoutIndex = (week * 2 + slotIndex) % cycle.length;
  const workoutType = cycle[workoutIndex];
  
  // Gerar o treino específico baseado no tipo
  switch (workoutType) {
    case 'tempo':
      return generateTempoRun(phase, paces, athleteLevel);
    case 'interval_1km':
      return generateIntervals(1000, week, totalWeeks, paces, athleteLevel);
    case 'interval_800m':
      return generateIntervals(800, week, totalWeeks, paces, athleteLevel);
    case 'interval_400m':
      return generateIntervals(400, week, totalWeeks, paces, athleteLevel);
    case 'threshold':
      return generateThresholdRun(phase, paces, athleteLevel);
    case 'fartlek':
      return generateFartlek(phase, paces, athleteLevel);
    case 'progressivo':
      return generateProgressivo(phase, paces, athleteLevel);
    case 'mp_block':
      return generateMarathonPaceBlocks(week, totalWeeks, paces);
    case 'race_pace':
      return generateRacePaceRun(goal, paces);
    // ... outros tipos
  }
}
```

### Novo Loop Principal: `generatePlan()`

```typescript
function generatePlan(...) {
  // ... setup inicial ...

  for (let w = 1; w <= weeks; w++) {
    const phase = getScientificPhase(w, weeks, goal, athleteLevel);
    const targetQualitySlots = QUALITY_SLOTS_PER_WEEK[goal][phase] || 1;
    let qualitySlotsFilled = 0;
    
    // 1. LONGÃO (sempre no dia designado)
    if (dayIndices.includes(longDayIdx)) {
      const longRun = generateLongRun(...);
      workouts.push({ ...longRun, week: w, weekday: getLongRunWeekday() });
    }
    
    // 2. TREINOS DE QUALIDADE (distribuídos nos outros dias)
    const qualityDays = dayIndices.filter(d => d !== longDayIdx);
    for (let i = 0; i < targetQualitySlots && i < qualityDays.length; i++) {
      if (isCutbackWeek && qualitySlotsFilled >= 1) break; // Cutback: max 1 qualidade
      
      const qualityWorkout = getQualityWorkout(goal, w, phase, i, paces, weeks, athleteLevel);
      workouts.push({ ...qualityWorkout, week: w, weekday: getWeekday(qualityDays[i]) });
      qualitySlotsFilled++;
    }
    
    // 3. EASY RUNS (preencher dias restantes)
    const remainingDays = qualityDays.slice(qualitySlotsFilled);
    for (const day of remainingDays) {
      const easyRun = generateEasyRun(w, phase, vol, paces, goal, athleteLevel);
      workouts.push({ ...easyRun, week: w, weekday: getWeekday(day) });
    }
  }
}
```

---

## Resultado Esperado Após Correções

### Plano 42k de 20 semanas:

| Semana | Fase | Long Run | Qualidade 1 | Qualidade 2 | Easy Runs | Total |
|--------|------|----------|-------------|-------------|-----------|-------|
| 1 | Base | 10km | - | - | 3x6km | 28km |
| 2 | Base | 12km | Fartlek 30min | - | 3x6km | 36km |
| 3 | Base | 14km | Strides | - | 3x7km | 42km |
| 4 | Base | 11km (cutback) | - | - | 3x5km | 26km |
| 5 | Build | 18km | Tempo 25min | Fartlek 30min | 2x8km | 50km |
| 6 | Build | 20km | 5x1km | Progressivo | 2x8km | 56km |
| 7 | Build | 22km | Threshold 3x10' | MP Block | 2x9km | 62km |
| 8 | Build | 17km (cutback) | Fartlek 30min | - | 2x7km | 38km |
| 9 | Build | 25km | 6x1km | Tempo 30min | 2x10km | 71km |
| 10 | Build | 27km | 6x800m | Threshold | 2x10km | 74km |
| 11 | Peak | 30km | 7x1km | MP Block | 2x10km | 77km |
| 12 | Peak | 23km (cutback) | Fartlek 35min | - | 2x8km | 47km |
| 13 | Peak | 32km | 8x800m | Tempo 30min | 2x10km | 80km |
| 14 | Peak | 35km | 5x1km | Progressivo | 2x10km | 82km |
| 15 | Peak | 32km | Threshold | MP Block | 2x9km | 77km |
| 16 | Peak | 25km (cutback) | Fartlek 30min | - | 2x8km | 49km |
| 17 | Taper | 22km | Tempo 20min | - | 2x7km | 43km |
| 18 | Taper | 18km | 4x1km | - | 2x6km | 36km |
| 19 | Taper | 14km | Shakeout | - | 2x5km | 29km |
| 20 | Taper | 10km (pré-prova) | Strides | - | 2x4km | 22km |

### Métricas Finais Esperadas:

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Qualidade % | 8.8% | 28% | +218% |
| Volume Pico | 40km/sem | 82km/sem | +105% |
| Longão Máximo | 31km | 35km | +13% |
| Intervalados Total | 1 | 16 | +1500% |
| Progressão de Paces | Estática | Dinâmica | N/A |

---

## Compatibilidade com Outros Objetivos

| Objetivo | Qualidade/Semana | Longão Max | Volume Pico | Intervalados |
|----------|------------------|------------|-------------|--------------|
| 5k | 2-3 | 14km | 40-50km | 400m, 800m, 1km |
| 10k | 2-3 | 18km | 50-60km | 800m, 1km |
| 21k | 2 | 26km | 60-70km | 1km, threshold |
| 42k | 2 | 35km | 75-85km | 1km, MP blocks |
| Condicionamento | 1 | 14km | 35-40km | Fartlek only |
| Perda de Peso | 1 | 14km | 40-50km | Fartlek + tempo |
| Melhorar Tempos | 2-3 | 22km | 50-60km | Todos os tipos |

---

## Técnico: Linhas de Código a Modificar

1. **Linhas 269-282**: Adicionar `QUALITY_SLOTS_PER_WEEK` e `QUALITY_CYCLES`
2. **Linhas 960-1093**: Reescrever loop `generatePlan()` para usar slots de qualidade
3. **Linhas 1095-1199**: Melhorar `generateLongRun()` com progressão linear
4. **Linhas 1201-1728**: Refatorar `generateSession()` para delegar a `getQualityWorkout()`
5. **Nova função** (inserir ~linha 1200): `getQualityWorkout()` com switch por tipo
6. **Linha 1282**: Aumentar caps de easy run para 42k

---

## Validação Pós-Implementação

Após implementar, executarei as seguintes queries para validar:

```sql
-- Verificar distribuição de qualidade por objetivo
SELECT goal_type, 
       AVG(quality_pct) as avg_quality_pct,
       AVG(max_longrun_km) as avg_max_longrun
FROM plan_stats
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY goal_type;
```

Meta: Todos os objetivos atingirem >= 25% de qualidade.
