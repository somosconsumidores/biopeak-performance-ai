
# Trigger para Refresh da mv_biopeak_nutritional_profile

## O que sera feito

Criar uma trigger na tabela `training_plans` que, a cada INSERT, dispara o refresh da materialized view `mv_biopeak_nutritional_profile`. Isso garante que o perfil nutricional esteja sempre atualizado quando um novo plano de treino for criado.

## Mudancas planejadas

### 1. Migration SQL
- Criar a funcao RPC `refresh_mv_biopeak_nutritional_profile()` (SECURITY DEFINER, search_path vazio) para refresh da view
- Criar a trigger function `trg_refresh_nutritional_profile_on_plan_insert()` que chama o refresh
- Criar a trigger `on_training_plan_insert_refresh_nutritional` na tabela `training_plans` disparada AFTER INSERT

### 2. Edge Function `refresh-materialized-views/index.ts`
- Adicionar chamada a `refresh_mv_biopeak_nutritional_profile` no cron noturno, garantindo que tambem seja atualizada diariamente

## Detalhes tecnicos

### Migration SQL

```sql
-- Funcao RPC para refresh
CREATE OR REPLACE FUNCTION refresh_mv_biopeak_nutritional_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_biopeak_nutritional_profile;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION trg_refresh_nutritional_profile_on_plan_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_biopeak_nutritional_profile;
  RETURN NEW;
END;
$$;

-- Trigger na tabela training_plans
CREATE TRIGGER on_training_plan_insert_refresh_nutritional
AFTER INSERT ON training_plans
FOR EACH ROW
EXECUTE FUNCTION trg_refresh_nutritional_profile_on_plan_insert();
```

### Edge Function update
Adicionar um quarto bloco no `refresh-materialized-views/index.ts` chamando `supabase.rpc("refresh_mv_biopeak_nutritional_profile")`.

### Nota sobre performance
O `REFRESH MATERIALIZED VIEW` executa de forma sincrona dentro da trigger. Como a view nao e excessivamente pesada e a insercao de planos de treino nao e frequente (poucos por dia), o impacto e aceitavel. Se no futuro o volume aumentar, pode-se migrar para `FOR EACH STATEMENT` em vez de `FOR EACH ROW`.
