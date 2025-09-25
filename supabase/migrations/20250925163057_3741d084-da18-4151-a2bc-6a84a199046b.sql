-- Test upsert functionality for RevenueCat webhook
-- Try to manually upsert the subscriber to test if RLS is blocking
UPDATE subscribers 
SET 
  subscribed = true,
  subscription_tier = 'premium',
  subscription_end = '2025-12-25T16:00:00Z',
  updated_at = now()
WHERE user_id = 'f6e3b2a4-048d-47b9-83de-e7986b4a989a';