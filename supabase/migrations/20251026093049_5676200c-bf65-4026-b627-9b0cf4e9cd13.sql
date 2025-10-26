-- Delete training plan data for specific users
DELETE FROM training_plan_workouts 
WHERE user_id IN (
  '0cce9431-ef11-4cef-b6b5-8644ad38af10',
  '667a62ea-b52b-4013-bbac-ced7d3a9409e',
  'ed8aa5c5-a616-4a57-9b5d-6157bcbe1997'
);

DELETE FROM training_plan_preferences 
WHERE user_id IN (
  '0cce9431-ef11-4cef-b6b5-8644ad38af10',
  '667a62ea-b52b-4013-bbac-ced7d3a9409e',
  'ed8aa5c5-a616-4a57-9b5d-6157bcbe1997'
);

DELETE FROM training_plans 
WHERE user_id IN (
  '0cce9431-ef11-4cef-b6b5-8644ad38af10',
  '667a62ea-b52b-4013-bbac-ced7d3a9409e',
  'ed8aa5c5-a616-4a57-9b5d-6157bcbe1997'
);