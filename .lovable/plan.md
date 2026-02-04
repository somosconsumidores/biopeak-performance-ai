

# Plano: Distribuição de Esforço por Treino Individual

## Objetivo
Adicionar o gráfico `EffortDistributionChart` na página `/workouts` (`WorkoutSession.tsx`) calculando a distribuição de esforço **específica do treino selecionado** usando os dados granulares de `activity_chart_data`.

## Análise Técnica

### Situação Atual
- O `EffortDistributionChart` em `/premium-stats` usa dados **mockados** (`Math.random()`)
- A página `/workouts` já carrega dados detalhados via `useActivityDetailsChart` que retorna séries temporais com:
  - `heart_rate` (FC por ponto)
  - `pace_min_per_km` (pace por ponto)  
  - `distance_km` (distância acumulada)

### Fonte de Dados Ideal
A tabela `activity_chart_data` contém o campo `series_data` com centenas/milhares de pontos por atividade, permitindo calcular a distribuição de esforço real dividindo a atividade em 3 terços:
- **Início**: primeiro 33% da distância/tempo
- **Meio**: 33-66% da distância/tempo
- **Fim**: 66-100% da distância/tempo

### Impacto na Performance

| Aspecto | Impacto |
|---------|---------|
| **Novas Queries** | Nenhuma - reutiliza os dados já carregados pelo `useActivityDetailsChart` |
| **Bundle Size** | Mínimo - o componente `EffortDistributionChart` já existe |
| **Renderização** | Baixo - cálculo local sobre dados já em memória |

## Implementação

### 1. Criar Hook `useSessionEffortDistribution`
Novo hook que processa os dados do `useActivityDetailsChart` para calcular a distribuição de esforço do treino.

```text
src/hooks/useSessionEffortDistribution.ts
```

**Lógica de Cálculo:**
1. Recebe os dados de `activity_chart_data.series_data`
2. Divide os pontos em 3 terços por distância ou índice
3. Calcula a média de FC (ou pace) de cada terço
4. Normaliza para percentual do esforço máximo
5. Determina o padrão: `negative_split`, `positive_split` ou `even_pace`

### 2. Adicionar Componente na WorkoutSession.tsx
Inserir o `EffortDistributionChart` após os cards de Comparação de Pace e Zonas de FC, mantendo a hierarquia de análise existente.

```text
Posição sugerida: após o HeartRateZonesCard (linha ~425)
```

### 3. Dados Necessários
O cálculo utilizará:
- **FC**: `series_data[].heart_rate` - média de FC por terço
- **Referência**: FC máxima da atividade para normalização percentual

```text
startEffort = (avg_hr_primeiro_terço / max_hr) * 100
middleEffort = (avg_hr_segundo_terço / max_hr) * 100  
endEffort = (avg_hr_terceiro_terço / max_hr) * 100
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useSessionEffortDistribution.ts` | **Criar** - hook para calcular distribuição por sessão |
| `src/pages/WorkoutSession.tsx` | **Modificar** - adicionar o gráfico |
| `src/components/EffortDistributionChart.tsx` | **Manter** - reutilizar componente existente |

## Visualização da Lógica

```text
┌─────────────────────────────────────────────────────────────┐
│                 SÉRIES TEMPORAIS DO TREINO                  │
│  [p1, p2, p3, ... p100, p101, ... p200, p201, ... p300]    │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐          ┌─────────┐          ┌─────────┐
    │ INÍCIO  │          │  MEIO   │          │   FIM   │
    │ 0-33%   │          │ 33-66%  │          │ 66-100% │
    │ avg(hr) │          │ avg(hr) │          │ avg(hr) │
    └────┬────┘          └────┬────┘          └────┬────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────────────────────────────────────────────────┐
    │     NORMALIZAÇÃO: (avg_hr / max_hr) * 100          │
    └─────────────────────────────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────────────┐
    │  PADRÃO: negative_split | positive_split | even    │
    │  (baseado na diferença entre início e fim)         │
    └─────────────────────────────────────────────────────┘
```

## Resultado Esperado
O atleta verá como distribuiu seu esforço durante o treino específico, podendo identificar se:
- **Negative Split** (ideal): Acelerou/intensificou no final
- **Positive Split**: Desacelerou/fadiga no final
- **Even Pace**: Ritmo/esforço constante

