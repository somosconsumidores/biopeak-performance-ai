

## Duas Correções Finais: CTL/ATL Normalizado + Deduplicação de Treinos

### Problema 1 — CTL/ATL com escala 10x

Os valores no banco estao multiplicados por ~10:
- CTL 879.03 no banco = **87.9** real
- ATL 266.72 no banco = **26.7** real

O codigo atual (linha 85) rejeita valores > 200, mas nao tenta normalizar. A correcao e dividir por 10 **antes** de validar.

**Correcao** (linhas 79-103):

```typescript
if (name === "get_fitness_scores") {
  const { data } = await sb.from('fitness_scores_daily')
    .select('calendar_date, ctl_42day, atl_7day')
    .eq('user_id', uid)
    .order('calendar_date', { ascending: false })
    .limit(1).maybeSingle();
  
  if (!data) return { found: false, reason: "Nenhum dado de carga encontrado" };
  
  let ctl = data.ctl_42day;
  let atl = data.atl_7day;
  
  // Normalizar escala: banco armazena valores ~10x maiores
  if (ctl > 200) ctl = ctl / 10;
  if (atl > 200) atl = atl / 10;
  
  // Sanity check pos-normalizacao
  if (!ctl || !atl || ctl > 200 || atl > 200 || ctl < 0 || atl < 0) {
    return {
      found: false,
      reason: `Valores de CTL/ATL fora do intervalo esperado mesmo apos normalizacao. Dado indisponivel.`
    };
  }
  
  const tsb = ctl - atl;
  return {
    found: true,
    ctl: ctl.toFixed(1),
    atl: atl.toFixed(1),
    tsb: tsb.toFixed(1),
    date: data.calendar_date,
    status: tsb > 25 ? 'Muito fresco — volume baixo recente'
           : tsb > 5  ? 'Fresco — pronto para treino intenso'
           : tsb > -5 ? 'Balanceado'
           : tsb > -25? 'Sob carga — monitore recuperacao'
           :            'Fadiga acumulada — priorize descanso'
  };
}
```

Resultado para o usuario do banco (CTL=879, ATL=267):
- CTL: **87.9**, ATL: **26.7**, TSB: **+61.2** → "Muito fresco"

---

### Problema 2 — Treinos duplicados

Ja existem 4 "Regenerativo 5km" para 20/02/2026. O `create_scientific_workout` (linha 325) faz INSERT direto sem verificar duplicatas.

**Correcao** (antes do INSERT na linha 325):

Adicionar uma query de verificacao que busca treinos com mesmo `user_id`, `workout_date` e `workout_type` no status `planned`. Se existir, retorna o treino existente em vez de criar outro.

```typescript
// Deduplicacao: verificar se ja existe treino identico
const { data: existing } = await sb.from('training_plan_workouts')
  .select('id, title, workout_date, description')
  .eq('user_id', uid)
  .eq('workout_date', args.date)
  .eq('workout_type', template.workout_type)
  .eq('status', 'planned')
  .limit(1)
  .maybeSingle();

if (existing) {
  return {
    success: true,
    already_exists: true,
    workout: { title: existing.title, date: existing.workout_date, description: existing.description },
    message: `Treino "${existing.title}" ja existe para ${args.date}. Nao criei duplicata.`
  };
}
```

---

### Limpeza dos duplicados existentes

Alem das correcoes no codigo, sera necessario remover os 3 treinos duplicados ja criados para 20/02/2026 (manter apenas o mais recente). Isso sera feito via migracao SQL:

```sql
DELETE FROM training_plan_workouts
WHERE id IN (
  SELECT id FROM training_plan_workouts
  WHERE workout_date = '2026-02-20'
    AND title = 'Regenerativo 5km'
    AND status = 'planned'
  ORDER BY created_at DESC
  OFFSET 1
);
```

---

### Resumo das mudancas

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/ai-coach-chat/index.ts` linhas 79-103 | Dividir CTL/ATL por 10 quando > 200, depois validar |
| `supabase/functions/ai-coach-chat/index.ts` antes da linha 325 | Check de duplicata antes do INSERT |
| Migracao SQL | Remover 3 treinos duplicados existentes |

### Resultado esperado

| Cenario | Antes | Depois |
|---|---|---|
| "Qual meu CTL/ATL?" | "Dados fora do intervalo (879/267)" | CTL: 87.9, ATL: 26.7, TSB: +61.2 - "Muito fresco" |
| "Crie treino leve para amanha" (repetido) | Cria duplicata cada vez | "Treino ja existe para essa data. Nao criei duplicata." |
