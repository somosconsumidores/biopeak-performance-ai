-- Deletar todos os registros do usuário af1bf63c-6c04-45de-93d4-b0248add41ea
DELETE FROM polar_activities WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM polar_tokens WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM polar_sync_control WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM garmin_activities WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM garmin_tokens WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM garmin_sync_control WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM garmin_activity_details WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM garmin_daily_summaries WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM garmin_backfill_requests WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM garmin_user_permissions WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM garmin_webhook_logs WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM oauth_temp_tokens WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM performance_metrics WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM profiles WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';
DELETE FROM user_commitments WHERE user_id = 'af1bf63c-6c04-45de-93d4-b0248add41ea';