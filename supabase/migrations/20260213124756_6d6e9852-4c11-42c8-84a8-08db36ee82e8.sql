
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
