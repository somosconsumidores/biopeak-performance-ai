
# Plano Final: Correção de Planos de Treino de Corrida "Fracos"

## Resumo Executivo

Após análise detalhada do código atual (`generate-training-plan/index.ts`) e da proposta v2.0 (Sonnet 4.5), este plano apresenta uma **fusão incremental** das melhores ideias de ambas as versões, mantendo estabilidade e corrigindo os problemas de planos conservadores demais.

---

## Diagnóstico Final

### Problemas Identificados no Código Atual

| Problema | Linha | Valor Atual | Impacto |
|----------|-------|-------------|---------|
| Volume semanal máximo fixo | 429 | 70km | Atletas avançados limitados |
| Longão máximo fixo | 433 | 32km | Maratonistas sub-preparados |
| Easy runs limitados | 994 | 12km | Volume diário insuficiente |
| Intervalados estáticos | 1059, 1204 | 5x1km, 8x400m | Sem progressão |
| Fase Base muito longa | 677-679 | 50% do plano | Atletas avançados "estagnados" |
| Nível do atleta ignorado | - | - | Todos recebem mesmos caps |
| Paces muito conservadores | 404-409 | +1.0 easy, +0.7 long | Treinos parecem "fáceis demais" |

---

## Solução: 6 Módulos de Correção

### Módulo 1: Configuração Dinâmica por Nível de Atleta

Criar um sistema de configuração que ajusta automaticamente os limites baseado no nível:

```text
Nível        | Volume Máx | Longão Máx | Easy Máx | Fase Base | Paces
-------------|------------|------------|----------|-----------|-------
Beginner     | 50km       | 25km       | 10km     | 50%       | Conservadores (+1.0)
Intermediate | 70km       | 32km       | 14km     | 42%       | Moderados (+0.8)
Advanced     | 90km       | 36km       | 18km     | 38%       | Agressivos (+0.6)
Elite        | 120km      | 40km       | 22km     | 35%       | Máximos (+0.5)
```

**Arquivo:** `supabase/functions/generate-training-plan/index.ts`
- Criar interface `AthleteLevelConfig`
- Criar função `getAthleteLevelConfig(level: string, goalType: string)`
- Modificar `AthleteCapacityAnalyzer.getMaxWeeklyKm()` para usar config
- Modificar `AthleteCapacityAnalyzer.getMaxLongRunKm()` para usar config

---

### Módulo 2: Periodização Científica (Inspirado v2.0)

Substituir a lógica de fases atual por uma classe `ScientificPeriodization` com proporções fisiologicamente validadas:

**Atual:**
- Base: 50% fixo
- Build: 30%
- Peak: 15%
- Taper: 5%

**Novo (por objetivo):**

```text
42K Maratona:    Base 45% | Build 32% | Peak 15% | Taper 8%
21K Meia:        Base 42% | Build 35% | Peak 16% | Taper 7%
10K:             Base 40% | Build 38% | Peak 15% | Taper 7%
5K:              Base 35% | Build 40% | Peak 18% | Taper 7%
```

**Métodos novos:**
- `getVolumeMultiplier(week)`: Progressão linear dentro de cada fase (0.6→1.0 base, 1.0→1.15 build, etc.)
- `getIntensityMultiplier(week)`: Acelera paces gradualmente (1.0→0.85 ao longo do plano)

---

### Módulo 3: Paces Ajustados por Zona de Treino

Modificar os deltas de pace para serem mais alinhados com as zonas de Daniels:

**Atual vs Novo:**

| Tipo de Treino | Atual | Novo (Atleta Médio) | Zona VO2max |
|----------------|-------|---------------------|-------------|
| Easy Run       | +1.00 | +0.70              | 60-65%      |
| Long Run       | +0.70 | +0.50              | 65-75%      |
| Tempo          | +0.20 | +0.15              | 85-90%      |
| Interval 1km   | -0.30 | -0.15              | 95-98%      |
| Interval 800m  | -0.40 | -0.25              | 98-100%     |
| Interval 400m  | -0.60 | -0.40              | 105-110%    |

**Implementação:** Criar função `adjustPacesByAthleteLevel(basePaces, athleteLevel)` que aplica multiplicadores:
- Beginner: Manter conservador (1.0x)
- Intermediate: 0.9x
- Advanced: 0.8x
- Elite: 0.7x

---

### Módulo 4: Progressão de Intervalados

Substituir repetições estáticas por progressão ao longo do plano:

**400m:**
```text
Semana 1-4:   6x400m
Semana 5-8:   8x400m
Semana 9-12:  10x400m
Semana 13+:   12x400m
```

**800m:**
```text
Semana 1-4:   4x800m
Semana 5-8:   6x800m
Semana 9-12:  8x800m
```

**1km:**
```text
Semana 1-4:   4x1km
Semana 5-8:   5x1km
Semana 9-12:  6x1km
Semana 13+:   8x1km
```

**Implementação:** Criar função `getIntervalReps(distance, week, totalWeeks, level)` que retorna quantidade progressiva.

---

### Módulo 5: Easy Runs e Long Runs Dinâmicos

**Easy Runs (linha 994):**
- Atual: `Math.min(12, ...)`
- Novo: `Math.min(easyCap[goal][level], baseDistance + week * progressionRate)`

```text
Caps por objetivo e nível:
5K:  Beg=10, Int=12, Adv=14, Elite=16
10K: Beg=12, Int=14, Adv=16, Elite=18
21K: Beg=14, Int=16, Adv=20, Elite=22
42K: Beg=16, Int=18, Adv=22, Elite=25
```

**Long Runs (linhas 826-878):**
Usar % do volume semanal alvo ao invés de fórmulas fixas:

```text
Fase Base:  28-35% do volume semanal
Fase Build: 35-40% do volume semanal
Fase Peak:  38-42% do volume semanal
Fase Taper: 25-30% do volume semanal
```

---

### Módulo 6: Passagem do Nível do Atleta para Edge Function

Modificar `useTrainingPlanWizard.ts` para enviar `athlete_level` no payload:

**Linhas 1037-1043:**
```typescript
default: // running
  edgeFunctionName = 'generate-training-plan';
  functionPayload = {
    plan_id: planId,
    declared_paces: declaredPaces,
    absolute_beginner: absoluteBeginner,
    athlete_level: wizardData.athleteLevel,        // NOVO
  };
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/functions/generate-training-plan/index.ts` | ~200 linhas modificadas |
| `src/hooks/useTrainingPlanWizard.ts` | ~5 linhas modificadas |

---

## Detalhes Técnicos de Implementação

### 1. Nova Interface de Configuração (Edge Function)

```typescript
interface AthleteLevelConfig {
  maxWeeklyKm: number;
  maxLongRunKm: number;
  maxEasyRunKm: number;
  basePhasePct: number;
  paceMultiplier: number;
  minWeeklyKm: number;
}

const LEVEL_CONFIGS: Record<string, AthleteLevelConfig> = {
  'Beginner': { maxWeeklyKm: 50, maxLongRunKm: 25, maxEasyRunKm: 10, basePhasePct: 0.50, paceMultiplier: 1.0, minWeeklyKm: 20 },
  'Intermediate': { maxWeeklyKm: 70, maxLongRunKm: 32, maxEasyRunKm: 14, basePhasePct: 0.42, paceMultiplier: 0.9, minWeeklyKm: 30 },
  'Advanced': { maxWeeklyKm: 90, maxLongRunKm: 36, maxEasyRunKm: 18, basePhasePct: 0.38, paceMultiplier: 0.8, minWeeklyKm: 40 },
  'Elite': { maxWeeklyKm: 120, maxLongRunKm: 40, maxEasyRunKm: 22, basePhasePct: 0.35, paceMultiplier: 0.7, minWeeklyKm: 50 },
};
```

### 2. Progressão de Intervalados

```typescript
function getIntervalReps(
  distanceM: 400 | 800 | 1000,
  week: number,
  totalWeeks: number,
  level: string
): number {
  const baseReps = { 400: 6, 800: 4, 1000: 4 };
  const maxReps = { 400: 12, 800: 10, 1000: 8 };
  
  const progress = week / totalWeeks;
  const levelMultiplier = level === 'Elite' ? 1.3 : level === 'Advanced' ? 1.2 : level === 'Intermediate' ? 1.1 : 1.0;
  
  const base = baseReps[distanceM];
  const max = maxReps[distanceM];
  const reps = Math.round(base + (max - base) * progress * levelMultiplier);
  
  return Math.min(max, reps);
}
```

### 3. Modificação de `getSafeTargetPaces`

```typescript
getSafeTargetPaces(goalType?: string, athleteLevel?: string) {
  // ... código existente ...
  
  const levelConfig = LEVEL_CONFIGS[athleteLevel || 'Intermediate'];
  const paceMult = levelConfig.paceMultiplier;
  
  return {
    // Paces ajustados pelo nível
    pace_easy: currentCapacityPace + (0.70 * paceMult),      // Era +1.0
    pace_long: currentCapacityPace + (0.50 * paceMult),      // Era +0.7
    pace_tempo: currentCapacityPace + (0.15 * paceMult),     // Era +0.2
    pace_interval_1km: currentCapacityPace - (0.15 / paceMult), // Era -0.3
    pace_interval_800m: currentCapacityPace - (0.25 / paceMult),// Era -0.4
    pace_interval_400m: currentCapacityPace - (0.40 / paceMult),// Era -0.6
    // ... resto igual ...
  };
}
```

---

## Benefícios Esperados

| Métrica | Antes | Depois |
|---------|-------|--------|
| Volume semanal máximo (Elite) | 70km | 120km |
| Longão máximo (42K, Advanced) | 32km | 36-38km |
| Easy runs (42K, Advanced) | 12km | 18-20km |
| Intervalados 1km (semana 12) | 5x1km | 6-8x1km |
| Fase Base (Advanced) | 50% | 38% |
| Qualidade percebida | "Plano fraco" | "Plano desafiador" |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Iniciantes sobrecarregados | Manter caps conservadores para Beginner |
| Lesões por aumento brusco | Progressão linear, nunca >10%/semana |
| Atletas com nível errado | Validação por histórico continua ativa |
| Regressão de funcionalidade | Testes unitários + deploy gradual |

---

## Cronograma de Implementação

1. **Fase 1:** Criar sistema de configuração por nível (Módulos 1 e 6)
2. **Fase 2:** Implementar ScientificPeriodization (Módulo 2)
3. **Fase 3:** Ajustar paces e intervalados (Módulos 3 e 4)
4. **Fase 4:** Atualizar Easy/Long runs (Módulo 5)
5. **Fase 5:** Testes e validação

Tempo estimado: ~3-4 horas de implementação
