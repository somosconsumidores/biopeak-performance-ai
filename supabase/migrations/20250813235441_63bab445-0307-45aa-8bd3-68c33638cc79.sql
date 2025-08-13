SELECT extensions.http_post(
  'https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/build-activity-chart-cache',
  '{"activity_id": "1180f6ee-6168-43e3-b3ee-cf2b1f5bc43c", "user_id": "854037c9-66d5-4aec-9393-4c430d197b4e", "version": 1}',
  'application/json'
) as response;