

# Plano: Fallback para VO2max Calculado (Daniels)

## Problema Identificado

O AI Coach busca VO2max **apenas** da tabela `garmin_vo2max`, mas:
- Muitos usuários têm `vo2_max_running: NULL` nessa tabela (Garmin não enviou/calculou)
- Existe VO2max calculado pela **Fórmula de Daniels** na view `v_all_activities_with_vo2_daniels`

**Dados comprovados:**
- Tabela `garmin_vo2max`: Muitos registros com `vo2_max_running: nil`
- View Daniels: Vários usuários com valores calculados (ex: 32.2, 34.7, 39.1, etc.)

## Solução

Adicionar fallback na tool `get_athlete_metrics`:
1. Buscar VO2max da tabela Garmin (atual)
2. Se NULL, buscar o melhor VO2max calculado via Daniels das atividades recentes

## Mudanças no Código

### Arquivo: `supabase/functions/ai-coach-chat/index.ts`

**Adicionar após linha 98 (após busca Garmin):**

```typescript
// Fallback: Get VO2max from Daniels formula if Garmin is null
if (!vo2max) {
  const { data: danielsData } = await sb
    .from('v_all_activities_with_vo2_daniels')
    .select('vo2_max_daniels, activity_date')
    .eq('user_id', uid)
    .not('vo2_max_daniels', 'is', null)
    .order('activity_date', { ascending: false })
    .limit(10);
  
  if (danielsData?.length) {
    // Use the maximum VO2max from recent activities (best effort)
    const maxDaniels = Math.max(...danielsData.map(d => d.vo2_max_daniels));
    vo2max = Math.round(maxDaniels * 10) / 10; // Round to 1 decimal
    vo2maxDate = danielsData[0]?.activity_date || null;
  }
}
```

**Modificar retorno (linha 139):**

```typescript
vo2max_source: vo2max ? (garminUserId && vo2maxFromGarmin ? 'Garmin' : 'Calculado (Daniels)') : null,
```

## Fluxo Completo

```text
get_athlete_metrics chamado
        ↓
┌───────────────────────────────────┐
│ Buscar garmin_vo2max              │
│ (vo2_max_running ou cycling)      │
└───────────────────────────────────┘
        ↓
   vo2max encontrado?
   ├── SIM → Retorna com source: "Garmin"
   └── NÃO ↓
┌───────────────────────────────────┐
│ Buscar v_all_activities_          │
│ with_vo2_daniels                  │
│ (melhor das últimas 10 atividades)│
└───────────────────────────────────┘
        ↓
   vo2max_daniels encontrado?
   ├── SIM → Retorna com source: "Calculado (Daniels)"
   └── NÃO → Retorna vo2max: null
```

## Resultado Esperado

Quando o usuário perguntar "Qual meu VO2max?":

**Cenário 1: Garmin tem dados**
> "Seu VO2max é **52 ml/kg/min** (Garmin, registrado em 05/02/2026)"

**Cenário 2: Garmin NULL, mas tem atividades**
> "Seu VO2max estimado é **39.1 ml/kg/min** (calculado via Fórmula de Daniels com base na sua melhor corrida recente)"

**Cenário 3: Sem dados**
> "Não temos medições de VO2max ainda. Quando você fizer mais corridas com pace e tempo registrados, poderemos calcular."

## Benefícios

- Cobertura muito maior de usuários
- Fallback transparente com fonte identificada
- Usa dados já existentes e calculados no sistema
- Sem mudanças no frontend

