-- Deletar todos os dados dos usuários especificados
DELETE FROM public.garmin_activities WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.garmin_activity_details WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.garmin_backfill_requests WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.garmin_daily_summaries WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.garmin_sync_control WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.garmin_tokens WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.garmin_user_permissions WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.garmin_webhook_logs WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.oauth_temp_tokens WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.performance_metrics WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.profiles WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');

DELETE FROM public.user_commitments WHERE user_id IN ('1761eacd-4a63-4bd3-96d8-6a07f9854f03', 'a5953b4c-ad4c-42eb-b4f5-40b5af25ddd4');