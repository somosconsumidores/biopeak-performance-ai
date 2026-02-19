-- Limpar treinos duplicados "Regenerativo 5km" para 20/02/2026 (manter apenas o mais recente)
DELETE FROM training_plan_workouts
WHERE id IN (
  SELECT id FROM training_plan_workouts
  WHERE workout_date = '2026-02-20'
    AND title = 'Regenerativo 5km'
    AND status = 'planned'
  ORDER BY created_at DESC
  OFFSET 1
);