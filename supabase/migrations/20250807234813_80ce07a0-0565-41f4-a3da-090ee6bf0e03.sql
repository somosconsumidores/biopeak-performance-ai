-- Clean up duplicate Strava tokens, keeping only the most recent one for each user
WITH ranked_tokens AS (
  SELECT id, user_id, created_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM strava_tokens
)
DELETE FROM strava_tokens 
WHERE id IN (
  SELECT id FROM ranked_tokens WHERE rn > 1
);