-- Reprocess the HealthKit activity with improved pace calculation
SELECT net.http_post(
  'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/calculate-activity-chart-data',
  jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3dsbWx0bGNsdG13YmhkcGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjQ1NjksImV4cCI6MjA2Nzc0MDU2OX0.vz_wCV_SEfsvWG7cSW3oJHMs-32x_XQF5hAYBY-m8sM'
  ),
  jsonb_build_object(
    'user_id', 'f6e3b2a4-048d-47b9-83de-e7986b4a989a',
    'activity_id', 'A7A4C8D9-4FB9-4D79-A177-BDD8319884D0',
    'activity_source', 'healthkit',
    'full_precision', true
  )
) as result;