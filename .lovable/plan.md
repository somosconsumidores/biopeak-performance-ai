

# Plano: AI Coach com Geração de Treinos Científicos Personalizados

## Problema Identificado

Quando você pede "crie um treino de VO2max para amanhã", o Coach atual:
- ❌ Apenas insere um registro genérico na agenda
- ❌ Não calcula intervalos, paces, ou recuperações
- ❌ Não usa seus dados de performance (VO2max, ritmos históricos)

## Solução

Criar uma tool `generate_scientific_workout` que use a mesma lógica científica do gerador de planos para criar treinos personalizados sob demanda.

## Como Vai Funcionar

Quando você pedir: *"Crie um treino de VO2max para amanhã"*

1. O LLM chama `get_athlete_metrics` para buscar:
   - Melhor pace de 5K/10K
   - VO2max estimado (Garmin ou calculado por Daniels)
   - FC máxima e zonas
   
2. O LLM chama `generate_scientific_workout` com:
   ```
   workout_type: "interval_vo2max"
   date: "2026-02-06"
   athlete_data: (dados coletados acima)
   ```

3. O sistema gera um treino estruturado:
   ```
   ✅ Aquecimento: 15min em ritmo leve (6:30 min/km)
   ✅ Principal: 6x800m @ 4:45 min/km (Z5, 90-95% FC)
      - Recuperação: 2min trote leve entre tiros
   ✅ Desaquecimento: 10min leve
   
   📊 Distância total: ~10km
   🎯 Zona de FC: 4-5 (VO2max)
   ```

## Tipos de Treino Suportados

| Tipo | Descrição |
|------|-----------|
| `interval_vo2max` | 800m-1km em Z5 (VO2max) |
| `interval_speed` | 400m rápidos (velocidade) |
| `tempo` | Corrida contínua em limiar |
| `threshold` | Blocos em Z4 |
| `long_run` | Longão com progressão |
| `fartlek` | Variação de ritmo |
| `recovery` | Corrida regenerativa |
| `progressivo` | Aumentando ritmo gradualmente |

## Mudanças Técnicas

### 1. Nova Tool: `get_athlete_metrics`

Busca dados de performance do atleta:
- VO2max (Garmin + Daniels calculado)
- Melhores paces (5K, 10K, meia, maratona)
- FC máxima e zonas
- Volume médio semanal recente

### 2. Tool Atualizada: `create_custom_workout`

Adicionados parâmetros opcionais:
- `workout_category`: `vo2max`, `threshold`, `tempo`, `long_run`, `recovery`, `speed`
- `use_athlete_data`: boolean para usar métricas reais

Se `use_athlete_data=true`, o sistema:
1. Busca métricas do atleta
2. Calcula paces específicos com base no VO2max/histórico
3. Gera descrição estruturada (aquecimento, principal, desaquecimento)
4. Define FC alvo e distância estimada

### 3. Prompt do Coach Atualizado

Instruções para o LLM:
- Ao criar treinos, SEMPRE buscar métricas primeiro
- Gerar descrições detalhadas com paces específicos
- Incluir aquecimento/desaquecimento
- Citar zonas de FC e distância total

## Exemplo de Fluxo

**Usuário**: "Preciso de um treino de VO2max para amanhã"

**Coach** (internamente):
1. Chama `get_athlete_metrics()` → retorna { vo2max: 52, pace_5k: 4:35, fc_max: 185 }
2. Chama `create_custom_workout({ date: "2026-02-06", workout_category: "vo2max", use_athlete_data: true })`
3. Sistema gera:
   - Título: "VO2max 6x800m"
   - Descrição estruturada com paces calculados
   - target_pace: 4:28 min/km
   - target_hr_zone: 5

**Coach responde**:
> "Criei seu treino de VO2max para amanhã:
> 
> **🏃 VO2max 6x800m**
> - Aquecimento: 15min em ritmo leve (~6:30/km)
> - Principal: 6x800m @ 4:28/km (Z5, ~175-185bpm)
>   - Recuperação: 2min trote entre tiros
> - Desaquecimento: 10min leve
> 
> 📊 Distância total: ~10km | ⏱️ Duração: ~55min"

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-coach-chat/index.ts` | Adicionar `get_athlete_metrics` tool + melhorar `create_custom_workout` com geração científica |

## Benefícios

- **Treinos personalizados**: Paces calculados com base no VO2max real
- **Estrutura científica**: Aquecimento, principal, desaquecimento sempre presentes
- **Zonas de FC corretas**: Baseadas na FC máxima do atleta
- **Pronto para executar**: Atleta sabe exatamente o que fazer

