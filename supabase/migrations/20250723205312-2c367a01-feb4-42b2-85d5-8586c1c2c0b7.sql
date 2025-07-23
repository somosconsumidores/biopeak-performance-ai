-- Limpeza de dados: remover todos os dados do usuário bede1703-dd5a-4704-9778-bd9ad4abb974

-- 1. Remover métricas de performance do usuário
DELETE FROM public.performance_metrics 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 2. Remover detalhes de atividades do usuário
DELETE FROM public.garmin_activity_details 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 3. Remover atividades do usuário
DELETE FROM public.garmin_activities 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 4. Remover resumos diários do usuário
DELETE FROM public.garmin_daily_summaries 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 5. Remover compromissos do usuário
DELETE FROM public.user_commitments 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 6. Remover solicitações de backfill do usuário
DELETE FROM public.garmin_backfill_requests 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 7. Remover logs de webhook do usuário
DELETE FROM public.garmin_webhook_logs 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 8. Remover controle de sincronização do usuário
DELETE FROM public.garmin_sync_control 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 9. Remover permissões do Garmin do usuário
DELETE FROM public.garmin_user_permissions 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 10. Remover tokens temporários do usuário
DELETE FROM public.oauth_temp_tokens 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 11. Remover tokens do Garmin do usuário
DELETE FROM public.garmin_tokens 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';

-- 12. Remover perfil do usuário (por último)
DELETE FROM public.profiles 
WHERE user_id = 'bede1703-dd5a-4704-9778-bd9ad4abb974';