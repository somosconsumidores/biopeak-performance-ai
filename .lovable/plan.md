
# Plano: Análise Combinada FC + Pace para Distribuição de Esforço

## Problema Identificado
A implementação atual classifica o padrão de esforço **apenas pela variação da FC**, o que é **fisiologicamente incorreto**:

| Situação | FC Final | Pace Final | Classificação Atual | Realidade |
|----------|----------|------------|---------------------|-----------|
| Cardiac Drift | ↑ Subiu | ↓ Caiu | ❌ Negative Split | **FADIGA** |
| Negative Split Real | ↑ Subiu | ↑ Subiu | ✅ Negative Split | Correto |

## Solução: Matriz de Decisão FC + Pace

A nova lógica cruzará as variações de FC e Pace para classificar corretamente:

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    MATRIZ DE CLASSIFICAÇÃO                          │
├─────────────┬─────────────┬─────────────────────────────────────────┤
│   FC Final  │ Pace Final  │ Classificação                           │
├─────────────┼─────────────┼─────────────────────────────────────────┤
│   ↑ Subiu   │  ↑ Mais rápido  │ 🏃 NEGATIVE SPLIT (ideal)          │
│   ↑ Subiu   │  ↓ Mais lento   │ 😰 CARDIAC DRIFT (fadiga)          │
│   ↓ Desceu  │  ↓ Mais lento   │ 🔻 POSITIVE SPLIT                  │
│   ↓ Desceu  │  ↑ Mais rápido  │ 💪 ECONOMY (economia de esforço)   │
│   = Estável │  = Estável      │ ⚖️  EVEN PACE (ritmo constante)    │
└─────────────┴─────────────┴─────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Atualizar Interface `EffortDistribution`
Adicionar novos padrões e métricas de pace:

```typescript
export interface EffortDistribution {
  // Esforço baseado em FC (existente)
  startEffort: number;
  middleEffort: number;
  endEffort: number;
  
  // NOVO: Pace por segmento (min/km)
  startPace: number | null;
  middlePace: number | null;
  endPace: number | null;
  
  // NOVO: Padrões expandidos
  pattern: 'negative_split' | 'positive_split' | 'even_pace' | 'cardiac_drift' | 'economy';
  
  // NOVO: Flags de diagnóstico
  hasCardiacDrift: boolean;
  paceChange: 'faster' | 'slower' | 'stable';
  hrChange: 'higher' | 'lower' | 'stable';
}
```

### 2. Nova Lógica de Cálculo no Hook
O hook `useSessionEffortDistribution` será atualizado para:

1. **Calcular média de pace por segmento** (além da FC)
2. **Determinar variação de pace** (início vs fim)
3. **Cruzar FC + Pace** para classificação correta
4. **Detectar cardiac drift** quando FC sobe mas pace cai

```text
Lógica de Detecção:
─────────────────────────────────────────────
hrChange = endAvgHR > startAvgHR + 2% ? 'higher' : 
           endAvgHR < startAvgHR - 2% ? 'lower' : 'stable'

paceChange = endAvgPace < startAvgPace - 2% ? 'faster' :
             endAvgPace > startAvgPace + 2% ? 'slower' : 'stable'

if (hrChange === 'higher' && paceChange === 'slower')
  → CARDIAC DRIFT

if (hrChange === 'higher' && paceChange === 'faster')
  → NEGATIVE SPLIT REAL
─────────────────────────────────────────────
```

### 3. Atualizar Componente `EffortDistributionChart`
Adicionar visualização dos novos padrões com cores e descrições apropriadas:

| Padrão | Cor | Badge | Descrição |
|--------|-----|-------|-----------|
| `negative_split` | Verde | 🏃 Negative Split | Acelerou e manteve eficiência |
| `positive_split` | Vermelho | 🔻 Positive Split | Desacelerou no final |
| `even_pace` | Azul | ⚖️ Even Pace | Ritmo constante |
| `cardiac_drift` | Laranja | 😰 Cardiac Drift | FC subiu mas pace caiu (fadiga) |
| `economy` | Roxo | 💪 Economia | Acelerou com menos esforço cardíaco |

### 4. Exibir Pace no Card (Opcional)
Mostrar o pace médio de cada segmento abaixo do esforço:

```text
┌─────────────────────────────────────────────────┐
│  Início      │     Meio       │      Fim       │
│   92.5%      │    94.2%       │    96.8%       │
│  5:45/km     │   5:38/km      │   5:52/km      │
│              │                │   (mais lento) │
└─────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useSessionEffortDistribution.ts` | Modificar | Adicionar cálculo de pace + matriz de decisão |
| `src/components/EffortDistributionChart.tsx` | Modificar | Novos padrões, cores e exibição de pace |

## Benefícios da Melhoria

1. **Diagnóstico Correto**: Identifica fadiga cardíaca vs aceleração real
2. **Feedback Educativo**: Atleta aprende sobre cardiac drift
3. **Dados Completos**: Mostra FC + Pace por segmento
4. **Sem Queries Adicionais**: Usa dados já carregados (`pace_min_per_km` existe nos dados)

## Impacto na Performance
**Zero** - apenas processamento local adicional sobre dados já em memória.
