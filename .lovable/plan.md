
# Plano: Card "Seu Último Treino" no Dashboard

## Resumo
Criar um novo card profissional no Dashboard que exibe a análise de desacoplamento aeróbico do último treino, gerada pela IA via n8n. O card será posicionado como o primeiro elemento da página, logo acima do "Perfil de Atleta".

## Arquitetura da Solução

### 1. Novo Hook: `useLastTrainingAnalysis`
**Arquivo**: `src/hooks/useLastTrainingAnalysis.ts`

Responsabilidades:
- Buscar o registro mais recente de `ai_coach_insights_history` onde `insight_type = 'ia_analysis_training'`
- Implementar cache local para carregamento instantâneo
- Retornar: `analysis` (string), `createdAt` (data), `loading`, `error`
- Apenas para assinantes ativos

### 2. Novo Componente: `LastTrainingCard`
**Arquivo**: `src/components/LastTrainingCard.tsx`

Visual e funcionalidades:
- Segue o padrão visual do `CoachAdviceCard` com glass-card e gradientes
- Header com ícone de atividade (Activity) e título "Seu Último Treino"
- Badge indicando que é análise de desacoplamento aeróbico
- Timestamp relativo ("há 2 horas")
- Texto da análise com truncamento e botão "Ver mais"
- Estado de loading com Skeleton
- Mostra prompt de upgrade para não-assinantes
- Não renderiza nada se não houver análise disponível

### 3. Integração no Dashboard
**Arquivo**: `src/pages/Dashboard.tsx`

Posicionamento na hierarquia (ordem final):
```text
1. Header ("Dashboard Performance")
2. TodayTrainingAlert
3. ★ LastTrainingCard (NOVO - primeiro card)
4. AthleteSegmentationCard (Perfil do Atleta)
5. CoachAdviceCard
6. CoachInsightsCarousel
7. Section Toggle + conteúdo das abas
```

---

## Detalhes Técnicos

### Hook `useLastTrainingAnalysis`

```typescript
interface LastTrainingAnalysis {
  id: string;
  analysis: string;
  createdAt: string;
}

// Busca do Supabase:
.from('ai_coach_insights_history')
.select('id, insight_data, created_at')
.eq('user_id', user.id)
.eq('insight_type', 'ia_analysis_training')
.order('created_at', { ascending: false })
.limit(1)
.single()
```

### Design do Card

```text
┌─────────────────────────────────────────────────────┐
│ ┌─────┐                                             │
│ │ 🏃 │  Seu Último Treino        há 2 horas        │
│ └─────┘  ┌──────────────────┐                       │
│          │ Desacoplamento   │                       │
│          └──────────────────┘                       │
│                                                     │
│  Com base nos dados apresentados, seu              │
│  desacoplamento de -0.94% indica que você teve     │
│  um desempenho excelente, conseguindo correr a     │
│  um ritmo maior na segunda metade do treino...     │
│                                                     │
│  ▼ Ver mais                                         │
└─────────────────────────────────────────────────────┘
```

Características visuais:
- Gradiente de fundo: `from-emerald-500/5 to-cyan-500/5`
- Ícone: Activity (lucide-react) em círculo com gradiente verde
- Badge: "Desacoplamento" com borda verde
- Animações suaves de hover

### Cache

Utilizar o sistema de cache existente em `@/lib/cache`:
```typescript
CACHE_KEYS.LAST_TRAINING_ANALYSIS = 'last_training_analysis'
CACHE_DURATIONS.LAST_TRAINING = 60 * 60 * 1000 // 1 hora
```

---

## Arquivos a Criar/Modificar

| Ação | Arquivo |
|------|---------|
| Criar | `src/hooks/useLastTrainingAnalysis.ts` |
| Criar | `src/components/LastTrainingCard.tsx` |
| Modificar | `src/pages/Dashboard.tsx` |
| Modificar | `src/lib/cache.ts` (adicionar novas chaves) |

---

## Considerações

1. **Não-assinantes**: Mostrar card bloqueado com call-to-action para upgrade (igual ao CoachAdviceCard)
2. **Sem análise**: Não renderizar o card (silent fail)
3. **Responsividade**: Card deve funcionar bem em mobile e desktop
4. **Performance**: Cache de 1 hora para evitar requisições repetidas
