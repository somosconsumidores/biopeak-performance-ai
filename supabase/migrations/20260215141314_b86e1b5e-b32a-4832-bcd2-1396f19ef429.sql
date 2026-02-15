
CREATE OR REPLACE FUNCTION fn_notify_n8n_training_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF NEW.sport_type != 'running' THEN
    RETURN NEW;
  END IF;

  SELECT display_name, gender, birth_date, weight_kg, height_cm
  INTO v_profile
  FROM public.profiles WHERE user_id = NEW.user_id;

  SELECT days_per_week, long_run_weekday
  INTO v_prefs
  FROM public.training_plan_preferences WHERE plan_id = NEW.id;

  SELECT segment_name INTO v_segment
  FROM public.athlete_segmentation
  WHERE user_id = NEW.user_id
  ORDER BY segmentation_date DESC LIMIT 1;

  SELECT best_pace_value INTO v_best_pace
  FROM public.my_personal_records
  WHERE user_id = NEW.user_id AND category = 'RUNNING' AND rank_position = 1
  LIMIT 1;

  v_target_pace := (NEW.plan_summary->'targets'->>'target_pace_min_km')::NUMERIC;

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

  IF v_best_pace IS NOT NULL THEN
    v_pace_formatted := FLOOR(v_best_pace)::TEXT || ':' ||
      LPAD(FLOOR((v_best_pace - FLOOR(v_best_pace)) * 60)::TEXT, 2, '0');
  END IF;

  IF v_target_pace IS NOT NULL THEN
    v_pace_alvo_formatted := FLOOR(v_target_pace)::TEXT || ':' ||
      LPAD(FLOOR((v_target_pace - FLOOR(v_target_pace)) * 60)::TEXT, 2, '0');
  END IF;

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
