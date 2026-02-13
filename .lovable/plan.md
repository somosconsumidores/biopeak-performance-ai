

# Alterar mv_biopeak_nutritional_profile para LEFT JOIN

## Problema
A view usa `INNER JOIN` entre `user_biometrics` e `activity_burn`, excluindo usuarios que nao possuem atividades nos ultimos 30 dias. A view ja trata valores nulos com `COALESCE`, entao basta trocar o JOIN.

## Mudanca

Uma unica migration SQL que faz `DROP` e recria a materialized view, trocando:

```
JOIN activity_burn act ON (bio.user_id = act.user_id)
```

por:

```
LEFT JOIN activity_burn act ON (bio.user_id = act.user_id)
```

Toda a logica de `COALESCE` ja existente (`avg_daily_active_kcal` default 0, `main_sport` default 'General') continuara funcionando normalmente.

Apos recriar a view, a migration executara `REFRESH MATERIALIZED VIEW mv_biopeak_nutritional_profile` para popular os dados imediatamente.

## Resultado Esperado

Usuarios com `weight_kg` e `height_cm` preenchidos (como o user `a9313aeb...`) passarao a aparecer na view com:
- `avg_active_kcal = 0`
- `sport_type = 'General'`
- BMR e TDEE calculados normalmente (TDEE = BMR * 1.1 quando sem atividades)

**Nota**: Usuarios sem `birth_date` continuarao excluidos pois a idade e necessaria para o calculo do BMR.

## Detalhes Tecnicos

- **Arquivo criado**: Nova migration SQL
- **Nenhum arquivo de codigo alterado** -- a view e consumida via query, sem mudanca na interface

