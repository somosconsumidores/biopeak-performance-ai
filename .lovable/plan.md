
# Plano: Adicionar Sincronização de Dados de Sono do HealthKit

## Situação Atual

O app BioPeak já exibe métricas de sono no Dashboard, mas atualmente só suporta duas fontes:
- **Garmin** (tabela `garmin_sleep_summaries`)
- **Polar** (tabela `polar_sleep`)

Usuários de **Apple Watch** que sincronizam pelo HealthKit não têm seus dados de sono exibidos, mesmo que a Apple colete essas informações detalhadas.

## O que a Apple Fornece

O HealthKit disponibiliza dados completos de sono através de `HKCategoryTypeIdentifierSleepAnalysis`:

| Estágio | Valor | Descrição |
|---------|-------|-----------|
| `inBed` | 0 | Tempo na cama (antes de dormir) |
| `asleepUnspecified` | 1 | Dormindo (sem classificação) |
| `awake` | 2 | Acordado durante a noite |
| `asleepCore` | 3 | Sono leve |
| `asleepDeep` | 4 | Sono profundo |
| `asleepREM` | 5 | Sono REM |

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO DE DADOS DE SONO                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Apple Watch ──► HealthKit (iOS) ──► BioPeakHealthKit Plugin    │
│                                              │                  │
│                                              ▼                  │
│                                    querySleepData()             │
│                                              │                  │
│                                              ▼                  │
│                         JS: useHealthKitSleepSync.ts            │
│                                              │                  │
│                                              ▼                  │
│                       Supabase: healthkit_sleep_summaries       │
│                                              │                  │
│                                              ▼                  │
│                      Dashboard ◄─── useDashboardMetrics.ts      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

### 1. Plugin Swift - Adicionar Query de Sono

**Arquivo**: `ios/App/App/BioPeakHealthKit.swift`

Adicionar permissão de leitura para sono e nova função `querySleepData`:

```swift
// Na lista de readTypes, adicionar:
HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!

// Nova função:
@objc public func querySleepData(_ call: CAPPluginCall) {
    let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!
    let startDate = Date(timeIntervalSinceNow: -7 * 24 * 60 * 60) // 7 dias
    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: Date())
    
    let query = HKSampleQuery(sampleType: sleepType, ...) { _, samples, _ in
        // Processar amostras por noite
        // Calcular: inBed, asleepCore (light), asleepDeep, asleepREM
        // Retornar array de noites com durações
    }
}
```

**Dados retornados:**
```json
{
  "sleepSessions": [
    {
      "date": "2024-01-30",
      "startTime": "2024-01-30T23:15:00Z",
      "endTime": "2024-01-31T07:30:00Z",
      "inBedSeconds": 29700,
      "totalSleepSeconds": 28500,
      "deepSleepSeconds": 5400,
      "lightSleepSeconds": 14400,
      "remSleepSeconds": 7200,
      "awakeSeconds": 1200
    }
  ]
}
```

### 2. Wrapper TypeScript

**Arquivo**: `src/lib/healthkit.ts`

Adicionar interface e método para sono:

```typescript
export interface HealthKitSleepSession {
  date: string;
  startTime: string;
  endTime: string;
  inBedSeconds: number;
  totalSleepSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSeconds: number;
}

// Na classe HealthKitWrapper:
async querySleepData(): Promise<HealthKitSleepSession[]> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
    const result = await this.plugin.querySleepData();
    return result.sleepSessions || [];
  }
  // Mock para desenvolvimento
  return [...];
}
```

### 3. Tabela no Supabase

**Nova tabela**: `healthkit_sleep_summaries`

```sql
CREATE TABLE healthkit_sleep_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  in_bed_seconds INTEGER DEFAULT 0,
  total_sleep_seconds INTEGER DEFAULT 0,
  deep_sleep_seconds INTEGER DEFAULT 0,
  light_sleep_seconds INTEGER DEFAULT 0,
  rem_sleep_seconds INTEGER DEFAULT 0,
  awake_seconds INTEGER DEFAULT 0,
  sleep_score INTEGER, -- calculado localmente
  source_name TEXT DEFAULT 'Apple Watch',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, calendar_date)
);
```

### 4. Hook de Sincronização

**Novo arquivo**: `src/hooks/useHealthKitSleepSync.ts`

Hook para buscar dados de sono do HealthKit e salvar no Supabase:

```typescript
export const useHealthKitSleepSync = () => {
  const syncSleepData = async () => {
    const sessions = await HealthKit.querySleepData();
    
    for (const session of sessions) {
      // Calcular score baseado em tempo total e estágios
      const sleepScore = calculateSleepScore(session);
      
      // Upsert no Supabase
      await supabase.from('healthkit_sleep_summaries').upsert({
        calendar_date: session.date,
        total_sleep_seconds: session.totalSleepSeconds,
        deep_sleep_seconds: session.deepSleepSeconds,
        // ...
        sleep_score: sleepScore
      });
    }
  };
  
  return { syncSleepData };
};
```

### 5. Dashboard - Adicionar HealthKit como Fonte

**Arquivo**: `src/hooks/useDashboardMetrics.ts`

Modificar `fetchSleepData` para incluir HealthKit como fallback:

```typescript
const fetchSleepData = async (): Promise<SleepAnalytics> => {
  // 1) Tenta Garmin primeiro
  // 2) Fallback para Polar
  // 3) NOVO: Fallback para HealthKit
  
  const { data: hkSleep } = await supabase
    .from('healthkit_sleep_summaries')
    .select('*')
    .eq('user_id', user.id)
    .order('calendar_date', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (hkSleep) {
    // Converter para formato SleepAnalytics
    return {
      sleepScore: hkSleep.sleep_score,
      totalSleepMinutes: Math.round(hkSleep.total_sleep_seconds / 60),
      deepSleepPercentage: calculatePercentage(hkSleep.deep_sleep_seconds, ...),
      // ...
    };
  }
};
```

## Arquivos Afetados

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `ios/App/App/BioPeakHealthKit.swift` | Modificar | Adicionar `querySleepData` e permissão de sono |
| `src/lib/healthkit.ts` | Modificar | Adicionar interface e método `querySleepData` |
| `src/hooks/useHealthKitSleepSync.ts` | Novo | Hook para sincronizar sono do HealthKit |
| `src/hooks/useDashboardMetrics.ts` | Modificar | Adicionar HealthKit como fallback para dados de sono |
| Supabase | Novo | Tabela `healthkit_sleep_summaries` |

## Cálculo do Sleep Score

A Apple não fornece um "sleep score" nativo como Garmin/Polar. Vamos calculá-lo baseado em:

```text
Score Base = (Total Sleep / 8 horas) * 100, max 100

Bônus de Qualidade:
  +10 pontos se Deep Sleep >= 15% do total
  +10 pontos se REM Sleep >= 20% do total
  -10 pontos se Awake > 10% do tempo na cama
  -5 pontos por hora abaixo de 6h de sono

Score Final = clamp(Score Base + Bônus, 0, 100)
```

## Ordem de Implementação

1. Criar tabela `healthkit_sleep_summaries` no Supabase
2. Modificar `BioPeakHealthKit.swift` para adicionar permissão e query de sono
3. Atualizar `src/lib/healthkit.ts` com nova interface e método
4. Criar hook `useHealthKitSleepSync.ts`
5. Integrar sincronização de sono no fluxo existente de sync do HealthKit
6. Modificar `useDashboardMetrics.ts` para buscar dados do HealthKit

## Resultado Esperado

Após implementação:
- Usuários de Apple Watch verão seus dados de sono no Dashboard
- Métricas incluem: tempo total, sono profundo, sono leve, REM, score calculado
- Dados sincronizam automaticamente junto com workouts
- Análise de IA de sono funcionará para usuários HealthKit
