
# Plano: Card de Comparação de Pace Médio

## Objetivo
Adicionar um novo card abaixo do "Resumo do Treino" em `/workouts` que compare o pace médio do treino selecionado com a média histórica de todas as atividades do mesmo tipo (últimos 30 dias) registrada na tabela `average_pace`.

## Análise de Impacto na Performance

### Impacto Esperado: Mínimo

A implementação **não prejudicará a performance** do app pelos seguintes motivos:

1. **Query Simples e Leve**: A consulta à tabela `average_pace` busca apenas 1 registro (última entrada da categoria correspondente)
2. **Tabela Pequena**: A tabela `average_pace` contém apenas 3 registros (RUNNING, CYCLING, SWIMMING)
3. **Cache Adequado**: Implementaremos cache de 24 horas, já que o cálculo é diário
4. **Nenhuma Agregação em Runtime**: Os dados já estão pré-calculados pelo cron job diário
5. **Carregamento Independente**: O card carrega seus dados de forma assíncrona, sem bloquear o restante da página

### Métricas de Performance

| Operação | Impacto |
|----------|---------|
| Query Supabase | ~20-50ms (1 row) |
| Cálculo de diferença | < 1ms |
| Renderização | Negligível |

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                 WorkoutSession.tsx                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Card: Resumo do Treino                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Card: Comparação de Pace (NOVO)         │  │
│  │  ┌────────────────┐     ┌────────────────────────┐   │  │
│  │  │ Seu Pace       │     │ Média da Comunidade    │   │  │
│  │  │ 6:30/km        │ vs  │ 6:67/km                │   │  │
│  │  └────────────────┘     └────────────────────────┘   │  │
│  │                                                      │  │
│  │  Badge: 5.5% mais rápido que a média 🚀              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Mapeamento de Activity Type para Category

A tabela `average_pace` usa categorias padronizadas:

| Activity Types | Category | Unidade |
|----------------|----------|---------|
| Run, RUNNING, TREADMILL_RUNNING, TRAIL_RUNNING, etc. | RUNNING | min/km |
| Ride, CYCLING, ROAD_BIKING, MOUNTAIN_BIKING, etc. | CYCLING | km/h |
| Swim, LAP_SWIMMING, OPEN_WATER_SWIMMING, SWIMMING | SWIMMING | min/100m |

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useAveragePaceComparison.ts` | Criar | Hook para buscar dados da tabela `average_pace` e calcular comparação |
| `src/components/PaceComparisonCard.tsx` | Criar | Componente visual seguindo o padrão glass-card |
| `src/pages/WorkoutSession.tsx` | Modificar | Importar e adicionar o novo componente |
| `src/lib/cache.ts` | Modificar | Adicionar nova chave de cache |

## Detalhes Técnicos

### 1. Hook: useAveragePaceComparison

```typescript
interface PaceComparisonData {
  currentPace: number;           // Pace da atividade atual
  communityAverage: number;      // Média da tabela average_pace
  difference: number;            // Diferença absoluta
  percentDifference: number;     // Diferença percentual
  isFasterThanAverage: boolean;  // Se está acima da média
  category: 'RUNNING' | 'CYCLING' | 'SWIMMING';
  unit: string;                  // 'min/km', 'km/h', 'min/100m'
  totalActivities: number;       // Total de atividades na média
}

// Função de mapeamento activity_type -> category
function mapActivityTypeToCategory(activityType: string): 'RUNNING' | 'CYCLING' | 'SWIMMING' | null {
  const upper = activityType.toUpperCase();
  
  const runningTypes = ['RUN', 'RUNNING', 'TREADMILL_RUNNING', 'TRAIL_RUNNING', 'VIRTUALRUN', ...];
  const cyclingTypes = ['RIDE', 'CYCLING', 'ROAD_BIKING', 'MOUNTAIN_BIKING', ...];
  const swimmingTypes = ['SWIM', 'LAP_SWIMMING', 'OPEN_WATER_SWIMMING', 'SWIMMING'];
  
  if (runningTypes.some(t => upper.includes(t))) return 'RUNNING';
  if (cyclingTypes.some(t => upper.includes(t))) return 'CYCLING';
  if (swimmingTypes.some(t => upper.includes(t))) return 'SWIMMING';
  
  return null;
}
```

### 2. Query Supabase

```typescript
// Busca o último registro da categoria correspondente
const { data } = await supabase
  .from('average_pace')
  .select('*')
  .eq('category', category)
  .order('calculated_at', { ascending: false })
  .limit(1)
  .single();
```

### 3. Componente: PaceComparisonCard

Seguirá exatamente o padrão visual do card "Resumo do Treino":
- Classes: `glass-card border-glass-border mb-8`
- Ícone: `TrendingUp` ou `BarChart3`
- Badge indicando se está acima/abaixo da média
- Grid responsivo com 2-3 colunas

### 4. Cache Strategy

```typescript
// Nova chave de cache
AVERAGE_PACE: 'biopeak_average_pace_cache_v1'

// Duração: 24 horas (dados calculados diariamente)
CACHE_DURATIONS.DAILY  // 24 * 60 * 60 * 1000
```

## UX/UI Design

### Card Visual

```text
┌─────────────────────────────────────────────────────────────┐
│  📊 Comparação com a Comunidade              [8.581 atletas]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐         ┌─────────────────────────┐   │
│  │   Seu Pace      │   VS    │   Média da Comunidade   │   │
│  │   🏃 6:30/km   │         │   📊 6:67/km           │   │
│  │   (este treino) │         │   (últimos 30 dias)     │   │
│  └─────────────────┘         └─────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🚀 Você está 5.5% mais rápido que a média!        │   │
│  │     Parabéns! Continue assim.                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ℹ️ Baseado em 8.581 corridas de todos os atletas BioPeak  │
│     nos últimos 30 dias.                                    │
└─────────────────────────────────────────────────────────────┘
```

### Estados do Card

1. **Loading**: Skeleton ou spinner
2. **Sem dados**: Mensagem "Pace não disponível para este tipo de atividade"
3. **Acima da média**: Badge verde + ícone 🚀
4. **Abaixo da média**: Badge laranja + ícone 💪 (motivacional)
5. **Próximo da média** (±2%): Badge azul + ícone ⚡

## Fluxo de Dados

1. Usuário seleciona atividade em `/workouts`
2. `WorkoutSession` passa `currentActivity` para `PaceComparisonCard`
3. `useAveragePaceComparison` hook:
   - Verifica cache local (24h)
   - Se expirado, busca na tabela `average_pace`
   - Mapeia `activity_type` para `category`
   - Calcula diferença percentual
4. `PaceComparisonCard` renderiza comparação visual

## Considerações de Edge Cases

1. **Atividade sem pace**: Não exibir o card
2. **Tipo de atividade não mapeável** (ex: academia): Não exibir o card
3. **Tabela average_pace vazia**: Exibir mensagem "Dados de comparação indisponíveis"
4. **Pace = 0**: Não calcular comparação

## Resumo da Implementação

1. Criar hook `useAveragePaceComparison.ts` com cache de 24h
2. Criar componente `PaceComparisonCard.tsx` seguindo padrão glass-card
3. Adicionar chave de cache em `src/lib/cache.ts`
4. Inserir componente em `WorkoutSession.tsx` após o card "Resumo do Treino"
