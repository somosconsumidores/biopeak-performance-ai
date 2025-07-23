
-- Limpeza de dados: manter apenas usuários 0605b180-b3f9-47db-8b6e-f300306f4e50 e 12532380-4cc7-437b-9de0-381d62a38cb1

-- 1. Remover métricas de performance de outros usuários
DELETE FROM public.performance_metrics 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 2. Remover detalhes de atividades de outros usuários
DELETE FROM public.garmin_activity_details 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 3. Remover atividades de outros usuários
DELETE FROM public.garmin_activities 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 4. Remover resumos diários de outros usuários
DELETE FROM public.garmin_daily_summaries 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 5. Remover compromissos de outros usuários
DELETE FROM public.user_commitments 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 6. Remover solicitações de backfill de outros usuários
DELETE FROM public.garmin_backfill_requests 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 7. Remover logs de webhook de outros usuários
DELETE FROM public.garmin_webhook_logs 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1')
  AND user_id IS NOT NULL;

-- 8. Remover controle de sincronização de outros usuários
DELETE FROM public.garmin_sync_control 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 9. Remover permissões do Garmin de outros usuários
DELETE FROM public.garmin_user_permissions 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 10. Remover tokens temporários de outros usuários
DELETE FROM public.oauth_temp_tokens 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1')
  AND user_id IS NOT NULL;

-- 11. Remover tokens do Garmin de outros usuários
DELETE FROM public.garmin_tokens 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- 12. Remover perfis de outros usuários (por último)
DELETE FROM public.profiles 
WHERE user_id NOT IN ('0605b180-b3f9-47db-8b6e-f300306f4e50', '12532380-4cc7-437b-9de0-381d62a38cb1');

-- Verificação final: contar registros restantes por tabela
SELECT 
  'performance_metrics' as table_name, 
  COUNT(*) as remaining_records 
FROM public.performance_metrics
UNION ALL
SELECT 
  'garmin_activity_details' as table_name, 
  COUNT(*) as remaining_records 
FROM public.garmin_activity_details
UNION ALL
SELECT 
  'garmin_activities' as table_name, 
  COUNT(*) as remaining_records 
FROM public.garmin_activities
UNION ALL
SELECT 
  'garmin_daily_summaries' as table_name, 
  COUNT(*) as remaining_records 
FROM public.garmin_daily_summaries
UNION ALL
SELECT 
  'user_commitments' as table_name, 
  COUNT(*) as remaining_records 
FROM public.user_commitments
UNION ALL
SELECT 
  'garmin_backfill_requests' as table_name, 
  COUNT(*) as remaining_records 
FROM public.garmin_backfill_requests
UNION ALL
SELECT 
  'garmin_webhook_logs' as table_name, 
  COUNT(*) as remaining_records 
FROM public.garmin_webhook_logs
UNION ALL
SELECT 
  'garmin_sync_control' as table_name, 
  COUNT(*) as remaining_records 
FROM public.garmin_sync_control
UNION ALL
SELECT 
  'garmin_user_permissions' as table_name, 
  COUNT(*) as remaining_records 
FROM public.garmin_user_permissions
UNION ALL
SELECT 
  'oauth_temp_tokens' as table_name, 
  COUNT(*) as remaining_records 
FROM public.oauth_temp_tokens
UNION ALL
SELECT 
  'garmin_tokens' as table_name, 
  COUNT(*) as remaining_records 
FROM public.garmin_tokens
UNION ALL
SELECT 
  'profiles' as table_name, 
  COUNT(*) as remaining_records 
FROM public.profiles
ORDER BY table_name;
