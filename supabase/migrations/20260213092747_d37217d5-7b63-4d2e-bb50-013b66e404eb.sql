
CREATE MATERIALIZED VIEW mv_active_training_plan_users AS
SELECT DISTINCT tp.user_id
FROM training_plans tp
WHERE tp.status = 'active';

REFRESH MATERIALIZED VIEW mv_active_training_plan_users;

CREATE OR REPLACE FUNCTION refresh_mv_active_training_plan_users()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_active_training_plan_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
