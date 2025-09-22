-- Use the reprocess-healthkit-activities function for proper authentication
SELECT net.http_post(
  'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/reprocess-healthkit-activities',
  jsonb_build_object('Content-Type', 'application/json'),
  jsonb_build_object('user_id', 'f6e3b2a4-048d-47b9-83de-e7986b4a989a')
) as result;