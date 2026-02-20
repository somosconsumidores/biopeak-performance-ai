

## Fingerprint de Eficiencia -- Plano de Implementacao

### Visao Geral

Criar uma analise exclusiva ("Fingerprint de Eficiencia") que segmenta atividades em trechos de ~250m, calcula um score de eficiencia por trecho (pace vs potencia vs FC), gera alertas e recomendacoes. Isso sera exposto via Edge Function, visualizado na pagina /workouts e integrado ao Coach IA.

---

### 1. Tabela de Cache: `efficiency_fingerprint`

Nova tabela para armazenar resultados calculados por atividade:

```sql
CREATE TABLE efficiency_fingerprint (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_id text NOT NULL UNIQUE,
  segments jsonb NOT NULL,        -- array de segmentos com metricas
  alerts jsonb DEFAULT '[]',      -- alertas textuais
  recommendations jsonb DEFAULT '[]', -- sugestoes para o coach
  overall_score numeric,          -- score geral 0-100
  computed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE efficiency_fingerprint ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own" ON efficiency_fingerprint FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service insert" ON efficiency_fingerprint FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update" ON efficiency_fingerprint FOR UPDATE USING (true);
```

### 2. Edge Function: `analyze-efficiency-fingerprint`

**Arquivo**: `supabase/functions/analyze-efficiency-fingerprint/index.ts`

**Input**: `{ activity_id, user_id }`

**Logica**:

1. Buscar `activity_chart_data.series_data` para o `activity_id`
2. Filtrar pontos com `speed_ms > 0` e `heart_rate > 0`
3. Segmentar a cada ~250m (acumular distancia ate threshold)
4. Para cada segmento calcular:
   - `avg_pace`, `avg_hr`, `avg_power` (se disponivel)
   - `efficiency_score`: se tem potencia, usa `speed / power * 1000` normalizado; senao usa `speed / hr * 1000` (fallback pace vs FC)
   - `hr_efficiency_delta`: variacao de FC vs velocidade relativa ao segmento anterior
   - Label: verde (score >= 70), amarelo (40-70), vermelho (< 40)
5. Gerar `alerts` detectando:
   - Queda de eficiencia > 15% em relacao a media movel
   - FC subindo > 8% sem ganho de velocidade
   - Queda abrupta de potencia
6. Gerar `recommendations` com 2-3 sugestoes baseadas nos padroes detectados
7. Calcular `overall_score` (media ponderada dos segmentos, com peso maior para segmentos finais)
8. Upsert na tabela `efficiency_fingerprint`

**Fallback sem potencia**: usar `speed_ms / heart_rate` como proxy de eficiencia.

### 3. UI na pagina /workouts (WorkoutSession.tsx)

Criar componente `EfficiencyFingerprintSection` inserido apos o card de "Distribuicao de Esforco" (linha ~411). Contera:

#### 3a. Hook `useEfficiencyFingerprint(activityId)`
- Busca cache na tabela `efficiency_fingerprint`
- Se nao existir, chama a Edge Function para calcular
- Retorna `{ segments, alerts, recommendations, overallScore, loading }`

#### 3b. Componente `EfficiencyFingerprintSection`

4 sub-secoes:

1. **Score Geral + Heatmap Grid**
   - Score circular tipo gauge (0-100)
   - Grid horizontal: eixo X = segmentos por distancia, cor de fundo = verde/amarelo/vermelho baseado no `efficiency_score`
   - Recharts AreaChart com gradiente de cores

2. **Grafico Sincronizado FC x Potencia x Pace**
   - Recharts ComposedChart com 3 linhas sobrepostas
   - Eixo Y esquerdo: FC (bpm) e Potencia (W)
   - Eixo Y direito: Pace (min/km)
   - Tooltip sincronizado mostrando os 3 valores + eficiencia do segmento

3. **Cards de Alertas**
   - Lista de alertas com icone de alerta, distancia do trecho e descricao
   - Badge vermelho/amarelo conforme severidade

4. **Bloco "Coach IA Recomenda"**
   - 2-3 cards com icone, titulo e descricao da recomendacao
   - Estilo consistente com glass-card e dark mode

#### 3c. Loading State
- Skeleton animado com texto "Calculando fingerprint de eficiencia..."
- Premium gate: so assinantes veem (consistente com DeepAnalysisSection)

### 4. Integracao com o Coach IA

Adicionar nova tool ao `ai-coach-chat`:

```typescript
{
  type: "function",
  function: {
    name: "get_efficiency_fingerprint",
    description: "Analise de eficiencia por segmento de uma atividade. Retorna score, alertas e recomendacoes.",
    parameters: {
      type: "object",
      properties: {
        activity_id: { type: "string", description: "ID da atividade" }
      },
      required: ["activity_id"]
    }
  }
}
```

**Implementacao no `executeTool`**:
- Buscar da tabela `efficiency_fingerprint` primeiro (cache)
- Se nao existir, invocar a Edge Function e buscar novamente
- Retornar resumo: score geral, top 3 alertas, recomendacoes
- Prompt atualizado para instruir o coach a citar "Fingerprint de Eficiencia", referenciar trechos especificos por distancia e sugerir treinos tecnicos correspondentes

### 5. Resumo dos Arquivos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela `efficiency_fingerprint` com RLS |
| `supabase/functions/analyze-efficiency-fingerprint/index.ts` | Nova Edge Function com logica de segmentacao e scoring |
| `supabase/config.toml` | Adicionar config da nova funcao |
| `src/hooks/useEfficiencyFingerprint.ts` | Hook para buscar/triggar analise |
| `src/components/EfficiencyFingerprintSection.tsx` | Componente principal com 4 sub-secoes |
| `src/components/EfficiencyHeatmapGrid.tsx` | Heatmap grid de eficiencia por segmento |
| `src/components/EfficiencySyncChart.tsx` | Grafico sincronizado FC x Power x Pace |
| `src/pages/WorkoutSession.tsx` | Inserir novo bloco apos EffortDistributionChart |
| `supabase/functions/ai-coach-chat/index.ts` | Nova tool `get_efficiency_fingerprint` + prompt update |

### 6. Criterios de Aceite

- Atividade 21929844707 (2475 pontos, com potencia) gera ~40 segmentos de 250m
- Atividades sem potencia usam fallback pace/FC sem erro
- Cache na tabela evita recalculo a cada visita
- Coach IA cita numeros reais do fingerprint (score, km do alerta)
- Dark mode e responsivo em mobile
- Loading skeleton enquanto calcula

