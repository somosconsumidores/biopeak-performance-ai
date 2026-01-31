
# Plano: Corrigir Mapeamento de Tipos de Atividade HealthKit

## Problema Identificado

O card de "Comparação com a Comunidade" não aparece para atividades sincronizadas do HealthKit porque o tipo de atividade está sendo salvo incorretamente como `"Other"` em vez de `"Run"`, `"Cycle"`, `"Swim"`, etc.

### Dados do Problema

| Atividade | activity_type (atual) | activity_type (correto) | pace_min_per_km |
|-----------|----------------------|------------------------|-----------------|
| 2900C1F1-4FF1-4501... | Other | Run | 5.86 |

O banco de dados mostra que **1392 atividades** estão classificadas como `"Other"` enquanto apenas **92** estão corretamente como `"Run"`.

### Causa Raiz

O plugin Swift retorna `workoutActivityType.rawValue` (um numero inteiro), mas o mapeamento no TypeScript em `useHealthKitSync.ts` esta incompleto e usa valores errados:

```text
MAPEAMENTO ATUAL (incorreto):
  1 → 'Run'      ← ERRADO (1 = AmericanFootball)
  2 → 'Walk'     ← ERRADO (2 = Archery)
  3 → 'Cycle'    ← ERRADO (3 = AustralianFootball)
  4 → 'Swim'     ← ERRADO (4 = Badminton)
  5 → 'Other'    ← ERRADO (5 = Baseball)
  13 → 'Run'     ← ERRADO (13 = Cycling!)
  Outros → 'Other'

VALORES CORRETOS DO ENUM HKWorkoutActivityType:
  37 → Running (Corrida)
  52 → Walking (Caminhada)
  13 → Cycling (Ciclismo)
  46 → Swimming (Natação)
  24 → Hiking (Trilha)
  16 → Elliptical (Elíptico)
  20 → FunctionalStrengthTraining (Musculação)
  50 → TraditionalStrengthTraining (Treino de Força)
  35 → Rowing (Remo)
  63 → HighIntensityIntervalTraining (HIIT)
  3000 → Other (Outro)
```

### Fluxo do Problema

```text
┌──────────────────────────────────────────────────────────────┐
│ Apple Watch grava workout de CORRIDA                         │
│ HKWorkoutActivityType.running (rawValue = 37)                │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ BioPeakHealthKit.swift envia para JS:                        │
│ { workoutActivityType: 37, ... }  ✅ Correto                 │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ useHealthKitSync.ts mapWorkoutType(37)                       │
│ → Não encontra 37 no mapa                                     │
│ → Retorna 'Other'  ❌ INCORRETO                               │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Salvo no banco: activity_type = 'Other'                       │
│ PaceComparisonCard não consegue mapear para categoria         │
│ → Card não é exibido                                          │
└──────────────────────────────────────────────────────────────┘
```

## Solução

### Arquivo: `src/hooks/useHealthKitSync.ts`

Corrigir a função `mapWorkoutType` com os valores corretos do enum `HKWorkoutActivityType` da Apple:

```typescript
const mapWorkoutType = (type: number): string => {
  // HKWorkoutActivityType enum values from Apple HealthKit
  // Reference: developer.apple.com/documentation/healthkit/hkworkoutactivitytype
  const workoutTypes: { [key: number]: string } = {
    // Running types
    37: 'Run',           // HKWorkoutActivityTypeRunning
    
    // Walking types
    52: 'Walk',          // HKWorkoutActivityTypeWalking
    24: 'Hike',          // HKWorkoutActivityTypeHiking
    
    // Cycling types
    13: 'Cycle',         // HKWorkoutActivityTypeCycling
    74: 'Cycle',         // HKWorkoutActivityTypeHandCycling
    
    // Swimming types
    46: 'Swim',          // HKWorkoutActivityTypeSwimming
    
    // Gym/Strength types
    20: 'Strength',      // HKWorkoutActivityTypeFunctionalStrengthTraining
    50: 'Strength',      // HKWorkoutActivityTypeTraditionalStrengthTraining
    
    // Cardio types
    16: 'Elliptical',    // HKWorkoutActivityTypeElliptical
    35: 'Rowing',        // HKWorkoutActivityTypeRowing
    63: 'HIIT',          // HKWorkoutActivityTypeHighIntensityIntervalTraining
    73: 'MixedCardio',   // HKWorkoutActivityTypeMixedCardio
    
    // Cross Training
    11: 'CrossTraining', // HKWorkoutActivityTypeCrossTraining
    
    // Dance
    14: 'Dance',         // HKWorkoutActivityTypeDance
    
    // Yoga/Mind-Body
    27: 'Yoga',          // HKWorkoutActivityTypeMindAndBody (covers Yoga)
    
    // Other/Default
    3000: 'Other',       // HKWorkoutActivityTypeOther
  };
  
  return workoutTypes[type] || 'Other';
};
```

### Arquivo: `src/hooks/useAveragePaceComparison.ts`

Expandir a lista de tipos de corrida para incluir os novos valores:

```typescript
const RUNNING_TYPES = [
  'run', 'running', 'treadmill_running', 'trail_running', 'virtualrun',
  'virtual_run', 'track_running', 'indoor_running', 'hike', 'hiking'
];
```

## Corrigir Atividades Existentes

Apos o deploy, sera necessario atualizar as atividades ja sincronizadas que estao com tipo incorreto. Isso pode ser feito de duas formas:

### Opção 1: SQL direto (recomendado para correção pontual)

```sql
-- Atualizar atividade específica
UPDATE healthkit_activities 
SET activity_type = 'Run'
WHERE healthkit_uuid = '2900C1F1-4FF1-4501-A3FB-2DBE840485C4';
```

### Opção 2: Re-sincronizar do HealthKit

O usuario pode forcar uma nova sincronizacao, que agora usara o mapeamento correto.

## Arquivos Afetados

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/hooks/useHealthKitSync.ts` | Corrigir função `mapWorkoutType` com valores corretos do enum |
| `src/hooks/useAveragePaceComparison.ts` | Expandir lista `RUNNING_TYPES` para incluir 'hike' |

## Resultado Esperado

Apos as correções:

1. Novas sincronizações do HealthKit vão salvar o tipo de atividade correto (Run, Walk, Cycle, Swim, etc.)
2. O card de "Comparação com a Comunidade" vai aparecer para todas as atividades de corrida, ciclismo e natação
3. As estatísticas de evolução vão agrupar corretamente as atividades por tipo

## Resumo

O problema era um mapeamento incorreto dos valores numéricos do enum `HKWorkoutActivityType` da Apple. O código usava valores arbitrários (1, 2, 3, 4, 5) quando os valores reais da Apple são diferentes (37 para corrida, 52 para caminhada, etc.). A correção é simples: atualizar o dicionário de mapeamento com os valores corretos.
