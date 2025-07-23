-- Limpeza de dados: remover todos os dados do usuário 46634cf6-569c-4d38-ae7f-2bb8501f9e32

-- 1. Remover métricas de performance do usuário
DELETE FROM public.performance_metrics 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 2. Remover detalhes de atividades do usuário
DELETE FROM public.garmin_activity_details 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 3. Remover atividades do usuário
DELETE FROM public.garmin_activities 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 4. Remover resumos diários do usuário
DELETE FROM public.garmin_daily_summaries 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 5. Remover compromissos do usuário
DELETE FROM public.user_commitments 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 6. Remover solicitações de backfill do usuário
DELETE FROM public.garmin_backfill_requests 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 7. Remover logs de webhook do usuário
DELETE FROM public.garmin_webhook_logs 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 8. Remover controle de sincronização do usuário
DELETE FROM public.garmin_sync_control 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 9. Remover permissões do Garmin do usuário
DELETE FROM public.garmin_user_permissions 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 10. Remover tokens temporários do usuário
DELETE FROM public.oauth_temp_tokens 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 11. Remover tokens do Garmin do usuário
DELETE FROM public.garmin_tokens 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';

-- 12. Remover perfil do usuário (por último)
DELETE FROM public.profiles 
WHERE user_id = '46634cf6-569c-4d38-ae7f-2bb8501f9e32';