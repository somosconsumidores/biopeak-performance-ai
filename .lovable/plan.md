
# Plano: Corrigir Exibição de Dados de Sono do HealthKit no Dashboard

## Problema Identificado

Os dados de sono do HealthKit estão sendo sincronizados corretamente para a tabela `healthkit_sleep_summaries` (6 registros encontrados para o usuário), mas o dashboard não exibe esses dados.

### Dados Encontrados no Banco

| Data | Sleep Score | Tempo Total (s) | Sono Profundo (s) | Sono Leve (s) | REM (s) |
|------|-------------|-----------------|-------------------|---------------|---------|
| 2026-01-31 | 55 | 15500 | 1477 | 9952 | 4071 |
| 2026-01-30 | 100 | 24360 | 2893 | 16160 | 5307 |
| 2026-01-29 | 89 | 22705 | 512 | 15016 | 7177 |
| 2026-01-28 | 97 | 22040 | 3979 | 13115 | 4946 |

### Causa Raiz

O código em `useDashboardMetrics.ts` já inclui a lógica correta para buscar dados do HealthKit como fallback (linhas 437-482). No entanto, há dois problemas:

1. **Cache do Dashboard**: O dashboard carrega dados em cache que podem não conter os dados de sono do HealthKit sincronizados recentemente. A busca de sono acontece de forma assíncrona após o carregamento inicial.

2. **`useSleepScoreHistory.ts`**: Este hook é usado pelo componente `SleepScoreChart.tsx` e NÃO inclui dados do HealthKit - apenas busca dados das tabelas `garmin_sleep_summaries` e `polar_sleep`.

### Fluxo do Problema

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Usuário sincroniza HealthKit                                 │
│    → Dados salvos em healthkit_sleep_summaries ✅               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Dashboard carrega (useDashboardMetrics)                      │
│    → Verifica cache primeiro                                    │
│    → Cache existe com sleepAnalytics: null                      │
│    → Usa dados do cache ❌                                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. fetchSleepData() é chamado assincronamente                   │
│    → Tenta Garmin primeiro → Não encontra                       │
│    → Tenta Polar → Não encontra                                 │
│    → Tenta HealthKit → Encontra dados!                          │
│    → Atualiza cache                                             │
│    → Mas se cache já foi usado, pode não atualizar UI ⚠️        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SleepScoreChart (useSleepScoreHistory)                       │
│    → Busca APENAS Garmin e Polar                                │
│    → Não busca healthkit_sleep_summaries ❌                     │
│    → Retorna array vazio → Componente não renderiza             │
└─────────────────────────────────────────────────────────────────┘
```

## Solução

### Arquivo 1: `src/hooks/useSleepScoreHistory.ts`

Adicionar busca de dados do HealthKit como terceira fonte:

```typescript
// Adicionar 'healthkit' ao tipo source
export interface SleepScoreData {
  date: string;
  score: number;
  source: 'garmin' | 'polar' | 'healthkit';  // Adicionar healthkit
}

// Na função fetchSleepScores, adicionar busca do HealthKit:

// Buscar dados do HealthKit
const { data: healthkitData, error: healthkitError } = await supabase
  .from('healthkit_sleep_summaries')
  .select('calendar_date, sleep_score')
  .eq('user_id', user.id)
  .not('sleep_score', 'is', null)
  .order('calendar_date', { ascending: true });

if (healthkitError) {
  console.error('Erro ao buscar dados HealthKit:', healthkitError);
}

// Adicionar dados do HealthKit ao array unificado
if (healthkitData) {
  healthkitData.forEach(item => {
    unifiedData.push({
      date: item.calendar_date,
      score: item.sleep_score,
      source: 'healthkit'
    });
  });
}
```

### Arquivo 2: `src/hooks/useDashboardMetrics.ts`

Melhorar a lógica de cache para garantir que dados de sono sejam buscados mesmo com cache válido:

```typescript
// Na função fetchDashboardData, após usar cache:
if (cached) {
  // ... código existente ...
  
  // Se o cache não tem dados de sono, buscar de forma assíncrona
  if (!cached.sleepAnalytics) {
    fetchSleepData().then(sleepData => {
      setSleepAnalytics(sleepData);
      // Atualizar cache com dados de sono
      setCachedData({
        ...cached,
        sleepAnalytics: sleepData,
      });
    });
  }
  
  setLoading(false);
  return;
}
```

### Arquivo 3: `src/components/SleepScoreChart.tsx`

Atualizar o texto do tooltip para exibir "Apple Watch" quando a fonte for healthkit:

```typescript
<p className="text-xs text-muted-foreground capitalize">
  Fonte: {data.source === 'healthkit' ? 'Apple Watch' : data.source}
</p>
```

## Arquivos Afetados

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/hooks/useSleepScoreHistory.ts` | Adicionar busca de dados HealthKit |
| `src/hooks/useDashboardMetrics.ts` | Melhorar lógica de cache para dados de sono |
| `src/components/SleepScoreChart.tsx` | Atualizar exibição da fonte |

## Resultado Esperado

Após as correções:

1. O card de "Análise do Sono" no Dashboard exibirá os dados sincronizados do Apple Watch
2. O gráfico de evolução do score de sono (`SleepScoreChart`) incluirá dados do HealthKit
3. A fonte será exibida como "Apple Watch" para dados do HealthKit
4. O cache será atualizado corretamente com os dados de sono

## Verificação de Sucesso

Para verificar se funcionou:
1. O usuário deve ver o card de sono no Dashboard com score 55 (último registro de 31/01)
2. O tempo dormido deve mostrar aproximadamente 4h 18m (15500 segundos)
3. As barras de progresso devem mostrar as porcentagens corretas de cada fase do sono
