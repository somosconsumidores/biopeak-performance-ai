
# Trigger para Notificar N8N sobre Novos Planos de Corrida

## Resumo

Criar uma trigger no banco de dados que, ao inserir um novo plano de corrida na tabela `training_plans`, monta o JSON no formato especificado e envia via `pg_net` para o webhook do n8n.

## Mapeamento de Dados

O JSON sera construido cruzando dados de 3 tabelas:

| Campo JSON | Fonte | Tabela |
|---|---|---|
| `atleta.nome` | `display_name` | `profiles` |
| `atleta.sexo` | `gender` | `profiles` |
| `atleta.data_nascimento` | `birth_date` | `profiles` |
| `atleta.peso_kg` | `weight_kg` | `profiles` |
| `atleta.altura_cm` | `height_cm` | `profiles` |
| `objetivo` | `goal_type` | `training_plans` (NEW row) |
| `nivel` | `segment_name` | `athlete_segmentation` (mais recente) |
| `paces.pace_5k` | `formatted_pace` WHERE `best_pace_value` | `my_personal_records` (rank 1, RUNNING) |
| `pace_alvo` | `target_pace_min_km` | `plan_summary` JSONB do plano |
| `distancia_alvo_km` | derivado de `goal_type` | mapeamento fixo (5k=5, 10k=10, etc.) |
| `frequencia_semanal` | `days_per_week` | `training_plan_preferences` |
| `dia_longao` | `long_run_weekday` | `training_plan_preferences` (0=domingo, 6=sabado) |
| `duracao_semanas` | `weeks` | `training_plans` |

### Mapeamentos fixos

**goal_type para objetivo:**
- `5k` -> `melhorar_tempo`
- `10k` -> `melhorar_tempo`
- `half_marathon` -> `melhorar_tempo`
- `marathon` -> `melhorar_tempo`
- `improve_times` -> `melhorar_tempo`
- `general_fitness` -> `condicionamento`
- `weight_loss` -> `emagrecimento`
- `return_running` -> `retorno`
- `maintenance` -> `manter_forma`

**goal_type para distancia_alvo_km:**
- `5k` -> 5
- `10k` -> 10
- `half_marathon` -> 21
- `marathon` -> 42
- Outros -> null

**long_run_weekday para dia_longao:**
- 0 -> `domingo`, 1 -> `segunda`, 2 -> `terca`, 3 -> `quarta`, 4 -> `quinta`, 5 -> `sexta`, 6 -> `sabado`

**segment_name para nivel:**
- `Elite Runner`, `Rising Star` -> `avancado`
- `Active Performer`, `Consistent Jogger` -> `intermediario`
- `Recovery Mode`, outros -> `iniciante`

### Paces

O campo `paces` sera preenchido a partir de `my_personal_records` (rank 1, categoria RUNNING) para o usuario. O `best_pace_value` (em min/km decimal) sera convertido para formato `M:SS`. Como a tabela nao tem distancias especificas (5K, 10K), o melhor pace geral sera usado como `pace_5k` e os demais serao null. O `pace_alvo` vira do `plan_summary->targets->target_pace_min_km` do proprio plano, convertido para formato `M:SS`.

## Implementacao

### Migration SQL

Uma unica migration contendo:

1. **Funcao `fn_notify_n8n_training_plan()`**: funcao trigger que:
   - Filtra apenas `sport_type = 'running'`
   - Faz JOINs com `profiles`, `training_plan_preferences`, `athlete_segmentation`, `my_personal_records`
   - Monta o JSON no formato exato solicitado
   - Envia via `net.http_post` para `https://biopeak-ai.app.n8n.cloud/webhook/plano-corrida`

2. **Trigger `trg_notify_n8n_training_plan`**: AFTER INSERT na tabela `training_plans`

### Detalhes Tecnicos

```sql
CREATE OR REPLACE FUNCTION fn_notify_n8n_training_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile RECORD;
  v_prefs RECORD;
  v_segment TEXT;
  v_best_pace NUMERIC;
  v_target_pace NUMERIC;
  v_payload JSONB;
  v_objetivo TEXT;
  v_nivel TEXT;
  v_distancia NUMERIC;
  v_dia_longao TEXT;
  v_pace_formatted TEXT;
  v_pace_alvo_formatted TEXT;
BEGIN
  -- Apenas planos de corrida
  IF NEW.sport_type != 'running' THEN
    RETURN NEW;
  END IF;

  -- Dados do atleta
  SELECT display_name, gender, birth_date, weight_kg, height_cm
  INTO v_profile
  FROM public.profiles WHERE user_id = NEW.user_id;

  -- Preferencias do plano
  SELECT days_per_week, long_run_weekday
  INTO v_prefs
  FROM public.training_plan_preferences WHERE plan_id = NEW.id;

  -- Segmentacao mais recente
  SELECT segment_name INTO v_segment
  FROM public.athlete_segmentation
  WHERE user_id = NEW.user_id
  ORDER BY segmentation_date DESC LIMIT 1;

  -- Melhor pace (RUNNING, rank 1)
  SELECT best_pace_value INTO v_best_pace
  FROM public.my_personal_records
  WHERE user_id = NEW.user_id AND category = 'RUNNING' AND rank_position = 1
  LIMIT 1;

  -- Pace alvo do plan_summary
  v_target_pace := (NEW.plan_summary->'targets'->>'target_pace_min_km')::NUMERIC;

  -- Mapeamentos
  v_objetivo := CASE NEW.goal_type
    WHEN '5k' THEN 'melhorar_tempo'
    WHEN '10k' THEN 'melhorar_tempo'
    WHEN 'half_marathon' THEN 'melhorar_tempo'
    WHEN 'marathon' THEN 'melhorar_tempo'
    WHEN 'improve_times' THEN 'melhorar_tempo'
    WHEN 'general_fitness' THEN 'condicionamento'
    WHEN 'weight_loss' THEN 'emagrecimento'
    WHEN 'return_running' THEN 'retorno'
    WHEN 'maintenance' THEN 'manter_forma'
    ELSE 'melhorar_tempo'
  END;

  v_distancia := CASE NEW.goal_type
    WHEN '5k' THEN 5
    WHEN '10k' THEN 10
    WHEN 'half_marathon' THEN 21
    WHEN 'marathon' THEN 42
    ELSE NULL
  END;

  v_nivel := CASE
    WHEN v_segment IN ('Elite Runner', 'Rising Star') THEN 'avancado'
    WHEN v_segment IN ('Active Performer', 'Consistent Jogger') THEN 'intermediario'
    ELSE 'iniciante'
  END;

  v_dia_longao := CASE COALESCE(v_prefs.long_run_weekday, 0)
    WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'   WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'   WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END;

  -- Formatar paces (decimal min/km -> M:SS)
  IF v_best_pace IS NOT NULL THEN
    v_pace_formatted := FLOOR(v_best_pace)::TEXT || ':' ||
      LPAD(FLOOR((v_best_pace - FLOOR(v_best_pace)) * 60)::TEXT, 2, '0');
  END IF;

  IF v_target_pace IS NOT NULL THEN
    v_pace_alvo_formatted := FLOOR(v_target_pace)::TEXT || ':' ||
      LPAD(FLOOR((v_target_pace - FLOOR(v_target_pace)) * 60)::TEXT, 2, '0');
  END IF;

  -- Montar payload
  v_payload := jsonb_build_object(
    'atleta', jsonb_build_object(
      'nome', COALESCE(v_profile.display_name, 'Nao informado'),
      'sexo', COALESCE(v_profile.gender, 'nao_informado'),
      'data_nascimento', v_profile.birth_date,
      'peso_kg', v_profile.weight_kg,
      'altura_cm', v_profile.height_cm
    ),
    'objetivo', v_objetivo,
    'nivel', v_nivel,
    'paces', jsonb_build_object(
      'pace_5k', v_pace_formatted,
      'pace_10k', NULL,
      'pace_21k', NULL,
      'pace_42k', NULL
    ),
    'pace_alvo', v_pace_alvo_formatted,
    'distancia_alvo_km', v_distancia,
    'frequencia_semanal', COALESCE(v_prefs.days_per_week, 3),
    'dia_longao', v_dia_longao,
    'duracao_semanas', NEW.weeks
  );

  -- Enviar via pg_net
  PERFORM net.http_post(
    url := 'https://biopeak-ai.app.n8n.cloud/webhook/plano-corrida',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := v_payload
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_n8n_training_plan
  AFTER INSERT ON public.training_plans
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_n8n_training_plan();
```

## Limitacoes Conhecidas

1. **Paces por distancia**: A tabela `my_personal_records` nao separa por distancia (5K, 10K, etc.), apenas tem o melhor pace geral de RUNNING. Portanto, apenas `pace_5k` sera preenchido com o melhor pace do atleta; `pace_10k`, `pace_21k` e `pace_42k` serao `null`.

2. **Timing**: As preferencias (`training_plan_preferences`) e o `plan_summary` precisam estar inseridos no banco ANTES do registro em `training_plans` para que a trigger consiga acessar esses dados. Se a insercao for feita em sequencia (prefs primeiro, plano depois), tudo funcionara normalmente.

3. **Atletas sem segmentacao**: Serao classificados como "iniciante" por padrao.
