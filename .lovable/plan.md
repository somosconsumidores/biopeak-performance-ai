
# Plano: Sistema de Segmentação de Atleta com IA

## Visão Geral

Criar um sistema de segmentação inteligente que classifica atletas em categorias significativas, atualizado semanalmente via cron job, com explicações personalizadas geradas por IA e exibido no Dashboard Performance com badges elegantes.

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE SEGMENTAÇÃO DE ATLETA                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │  CRON JOB       │  Domingo 00:00 UTC-3 (São Paulo)                       │
│  │  (pg_cron)      │────────────────────────────────────────┐               │
│  └─────────────────┘                                        │               │
│                                                             ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                  EDGE FUNCTION: compute-athlete-segmentation        │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  1. Buscar todos os usuários ativos (subscribers + activities)      │    │
│  │  2. Para cada usuário:                                              │    │
│  │     ├─ Coletar métricas de all_activities (8 semanas)               │    │
│  │     ├─ Buscar PRs de activity_best_segments                         │    │
│  │     ├─ Consultar VO2 Max (garmin_vo2max + v_all_activities_daniels) │    │
│  │     ├─ Verificar training_plans (adesão, progresso)                 │    │
│  │     └─ Calcular evolução vs período anterior                        │    │
│  │  3. Classificar em categoria (Rising Star, Consistent, etc.)        │    │
│  │  4. Chamar OpenAI para gerar explicação personalizada               │    │
│  │  5. Salvar em athlete_segmentation                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                             │               │
│                                                             ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                   TABELA: athlete_segmentation                      │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  user_id, segment_name, badge_icon, ai_explanation,                 │    │
│  │  metrics_snapshot (JSONB), score, trend, created_at                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                             │               │
│                                                             ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │             FRONTEND: Dashboard Performance                         │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  🏃 AthleteSegmentationCard                                  │    │    │
│  │  │  ┌────────────────────────────────────────────────────────┐ │    │    │
│  │  │  │  [Badge Icon]  "Rising Star" ⬆️                        │ │    │    │
│  │  │  │  ────────────────────────────────────────────────────  │ │    │    │
│  │  │  │  "Você está em uma trajetória ascendente! Nas últimas  │ │    │    │
│  │  │  │  8 semanas, seu pace médio melhorou 8%, você aumentou  │ │    │    │
│  │  │  │  a distância semanal em 15% e bateu 2 PRs pessoais..." │ │    │    │
│  │  │  └────────────────────────────────────────────────────────┘ │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Categorias de Segmentação

| Segmento | Ícone | Cor | Critérios |
|----------|-------|-----|-----------|
| **Rising Star** ⭐ | rocket | Amarelo/Dourado | Melhoria >10% em pace ou distância, PRs recentes, tendência ascendente |
| **Consistent Performer** 💎 | gem | Azul | Mantém volume e intensidade estáveis, sem queda, treina 3+ vezes/semana |
| **Comeback Hero** 🔥 | flame | Laranja | Retornou após período inativo (>2 semanas) com atividade nas últimas 2 semanas |
| **Endurance Builder** 🏔️ | mountain | Verde | Foco em aumentar distância/volume, sem foco em velocidade |
| **Speed Demon** ⚡ | zap | Roxo | Foco em melhorar pace/velocidade, PRs de 1km recentes |
| **Recovery Mode** 😴 | moon | Cinza | Volume reduzido intencionalmente, descanso ativo |
| **Getting Started** 🌱 | seedling | Verde claro | <4 semanas de dados ou <8 atividades |

## Estrutura de Dados

### Tabela: `athlete_segmentation`

```sql
CREATE TABLE athlete_segmentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Segmento principal
  segment_name TEXT NOT NULL,  -- Ex: "Rising Star", "Consistent Performer"
  badge_icon TEXT NOT NULL,    -- Ex: "rocket", "gem", "flame"
  badge_color TEXT NOT NULL,   -- Ex: "yellow", "blue", "orange"
  
  -- Explicação gerada por IA
  ai_explanation TEXT NOT NULL,
  
  -- Snapshot das métricas usadas na análise
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  -- Exemplo:
  -- {
  --   "weekly_distance_km": 35.2,
  --   "weekly_frequency": 4.5,
  --   "avg_pace_min_km": 5.42,
  --   "pace_improvement_percent": 8.3,
  --   "distance_improvement_percent": 15.1,
  --   "vo2_max": 48.5,
  --   "personal_records_count": 2,
  --   "training_plan_adherence_percent": 85
  -- }
  
  -- Score composto (0-100) para ordenação/comparação
  composite_score NUMERIC(5,2),
  
  -- Tendência: up, down, stable
  trend TEXT NOT NULL DEFAULT 'stable',
  
  -- Período analisado
  analysis_period_start DATE,
  analysis_period_end DATE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: um registro por usuário por semana
  UNIQUE(user_id, created_at::date)
);

-- Index para busca rápida
CREATE INDEX idx_athlete_segmentation_user_latest 
  ON athlete_segmentation(user_id, created_at DESC);

-- RLS
ALTER TABLE athlete_segmentation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own segmentation"
  ON athlete_segmentation FOR SELECT
  USING (auth.uid() = user_id);
```

## Edge Function: `compute-athlete-segmentation`

### Algoritmo de Classificação

```typescript
// Pseudocódigo do algoritmo de classificação
function classifyAthlete(metrics: AthleteMetrics): SegmentResult {
  const { 
    weeklyActivities, 
    paceImprovement, 
    distanceImprovement,
    prCount,
    daysInactive,
    vo2Max,
    trainingPlanAdherence
  } = metrics;

  // 1. Getting Started - dados insuficientes
  if (weeklyActivities < 2 || metrics.totalWeeks < 4) {
    return { segment: "Getting Started", icon: "seedling", color: "green-300" };
  }

  // 2. Comeback Hero - retornou de inatividade
  if (daysInactive > 14 && metrics.recentActivityDays <= 14) {
    return { segment: "Comeback Hero", icon: "flame", color: "orange" };
  }

  // 3. Rising Star - melhorando rapidamente
  if (paceImprovement > 10 || distanceImprovement > 15 || prCount >= 2) {
    return { segment: "Rising Star", icon: "rocket", color: "yellow" };
  }

  // 4. Speed Demon - foco em velocidade
  if (paceImprovement > 5 && distanceImprovement < 5) {
    return { segment: "Speed Demon", icon: "zap", color: "purple" };
  }

  // 5. Endurance Builder - foco em volume
  if (distanceImprovement > 10 && paceImprovement < 3) {
    return { segment: "Endurance Builder", icon: "mountain", color: "green" };
  }

  // 6. Recovery Mode - volume reduzido
  if (distanceImprovement < -20 || weeklyActivities < 2) {
    return { segment: "Recovery Mode", icon: "moon", color: "gray" };
  }

  // 7. Consistent Performer - padrão estável
  return { segment: "Consistent Performer", icon: "gem", color: "blue" };
}
```

### Prompt para OpenAI

```typescript
const prompt = `
Você é um coach de corrida experiente e motivador. Analise o perfil do atleta abaixo e escreva uma explicação personalizada (2-3 parágrafos, máximo 150 palavras) sobre sua performance recente.

**Categoria Atribuída:** ${segmentName}

**Métricas das Últimas 8 Semanas:**
- Distância Semanal Média: ${metrics.weeklyDistanceKm} km
- Frequência: ${metrics.weeklyFrequency} treinos/semana
- Pace Médio: ${metrics.avgPaceMinKm} min/km
- Melhoria de Pace: ${metrics.paceImprovement}%
- Melhoria de Distância: ${metrics.distanceImprovement}%
- VO2 Max: ${metrics.vo2Max || 'não disponível'}
- PRs Pessoais Recentes: ${metrics.prCount}
- Adesão ao Plano de Treino: ${metrics.planAdherence || 'sem plano ativo'}%

**Instruções:**
1. Comece com uma frase positiva e encorajadora relacionada à categoria
2. Destaque 2-3 pontos fortes específicos baseados nos dados
3. Se houver espaço para melhoria, sugira de forma construtiva
4. Termine com uma frase motivacional curta
5. Use linguagem informal mas profissional, em português brasileiro
6. NÃO use emojis no texto
`;
```

## Componente Frontend: `AthleteSegmentationCard`

### Arquivo: `src/components/AthleteSegmentationCard.tsx`

```typescript
// Estrutura do componente
interface AthleteSegmentationCardProps {
  className?: string;
}

export function AthleteSegmentationCard({ className }: AthleteSegmentationCardProps) {
  const { segmentation, loading, error } = useAthleteSegmentation();
  
  // Badge icons mapping
  const iconMap = {
    rocket: Rocket,
    gem: Gem,
    flame: Flame,
    mountain: Mountain,
    zap: Zap,
    moon: Moon,
    seedling: Sprout,
  };
  
  // Badge colors mapping
  const colorMap = {
    yellow: 'from-yellow-500 to-amber-500',
    blue: 'from-blue-500 to-indigo-500',
    orange: 'from-orange-500 to-red-500',
    green: 'from-green-500 to-emerald-500',
    purple: 'from-purple-500 to-violet-500',
    gray: 'from-gray-400 to-slate-500',
    'green-300': 'from-green-300 to-teal-400',
  };
  
  // Render card com badge animado e explicação IA
}
```

### Design do Badge

```text
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         🚀                                               │   │
│  │     ┌───────────────────────────────────────┐            │   │
│  │     │       RISING STAR                     │            │   │
│  │     │       ──────────────────────          │            │   │
│  │     │       Tendência: ⬆️ Ascendente        │            │   │
│  │     └───────────────────────────────────────┘            │   │
│  │                                                          │   │
│  │  "Você está em uma trajetória impressionante! Nas        │   │
│  │  últimas 8 semanas, seu pace médio melhorou 8.3%,        │   │
│  │  passando de 5:52/km para 5:21/km. Além disso, você      │   │
│  │  aumentou sua distância semanal em 15%, alcançando uma   │   │
│  │  média de 35km por semana.                               │   │
│  │                                                          │   │
│  │  Seus 2 recordes pessoais recentes mostram que o         │   │
│  │  trabalho está dando resultado. Continue focando na      │   │
│  │  consistência e lembre-se: cada quilômetro te deixa      │   │
│  │  mais forte."                                            │   │
│  │                                                          │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  📊 Métricas: 35.2 km/sem • 4.5 treinos • 5:21 pace      │   │
│  │  🕐 Atualizado: 02/02/2026                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Cron Job Configuration

```sql
-- Executar todo domingo às 03:00 UTC (00:00 horário de Brasília)
SELECT cron.schedule(
  'weekly-athlete-segmentation',
  '0 3 * * 0',  -- Domingo, 03:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/compute-athlete-segmentation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM"}'::jsonb,
    body := concat('{"triggered_at": "', now(), '"}')::jsonb
  );
  $$
);
```

## Arquivos a Criar/Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx_athlete_segmentation.sql` | Novo | Criar tabela + índices + RLS |
| `supabase/functions/compute-athlete-segmentation/index.ts` | Novo | Edge function principal |
| `src/hooks/useAthleteSegmentation.ts` | Novo | Hook para consumir dados |
| `src/components/AthleteSegmentationCard.tsx` | Novo | Componente visual do badge |
| `src/pages/Dashboard.tsx` | Modificar | Adicionar card na seção de Performance |

## Dependências

### Secrets Necessárias
- `OPENAI_API_KEY` - Já configurada no projeto (usada por analyze-workout)

### Extensões Supabase
- `pg_cron` - Para agendamento (já habilitada)
- `pg_net` - Para HTTP requests do cron (já habilitada)

## Ordem de Implementação

1. **Migração SQL**: Criar tabela `athlete_segmentation` com índices e RLS
2. **Edge Function**: Implementar `compute-athlete-segmentation`
3. **Hook React**: Criar `useAthleteSegmentation` 
4. **Componente UI**: Criar `AthleteSegmentationCard`
5. **Dashboard**: Integrar card na seção de Performance
6. **Cron Job**: Configurar agendamento semanal via SQL

## Resultado Esperado

Após implementação:
- Todos os atletas receberão uma classificação semanal automaticamente
- O Dashboard Performance exibirá um badge visual com a categoria do atleta
- Uma explicação personalizada gerada por IA acompanha o badge
- O histórico de segmentações fica registrado para análise de evolução futura
- Atletas entenderão de forma clara e motivadora como sua performance está evoluindo
