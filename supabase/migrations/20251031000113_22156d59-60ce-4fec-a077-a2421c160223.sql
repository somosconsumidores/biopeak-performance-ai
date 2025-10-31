-- Delete records from training_plan_preferences, keeping only specified users
DELETE FROM training_plan_preferences 
WHERE user_id NOT IN (
  '5ada3a11-2374-4b77-98a5-219607683161',
  'd979c96d-af30-4a9f-81a2-b31190c697cb',
  '9437affd-a797-4a0b-8223-bdc99b20d318'
);

-- Delete records from training_plan_workouts, keeping only specified users
DELETE FROM training_plan_workouts 
WHERE user_id NOT IN (
  '5ada3a11-2374-4b77-98a5-219607683161',
  'd979c96d-af30-4a9f-81a2-b31190c697cb',
  '9437affd-a797-4a0b-8223-bdc99b20d318'
);

-- Delete records from training_plans, keeping only specified users
DELETE FROM training_plans 
WHERE user_id NOT IN (
  '5ada3a11-2374-4b77-98a5-219607683161',
  'd979c96d-af30-4a9f-81a2-b31190c697cb',
  '9437affd-a797-4a0b-8223-bdc99b20d318'
);