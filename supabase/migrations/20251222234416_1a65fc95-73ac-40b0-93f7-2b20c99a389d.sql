-- Ajustar corridas leves (easy) para 7:15/km (7.25 em decimal)
UPDATE training_plan_workouts
SET target_pace_min_km = 7.25,
    updated_at = now()
WHERE plan_id = '5ff7fd66-e2c0-471f-87b6-46f852f99a4b'
  AND workout_type = 'easy'
  AND status = 'planned'
  AND workout_date >= CURRENT_DATE;

-- Ajustar longões para 6:50/km (6.83 em decimal)
UPDATE training_plan_workouts
SET target_pace_min_km = 6.83,
    updated_at = now()
WHERE plan_id = '5ff7fd66-e2c0-471f-87b6-46f852f99a4b'
  AND workout_type = 'long_run'
  AND status = 'planned'
  AND workout_date >= CURRENT_DATE;