-- Corrigir o status de sincronização do usuário c87ff11f-3cef-4873-856d-43ba00454c81
-- que está como 'in_progress' mas deveria ser 'completed' já que as atividades foram sincronizadas

UPDATE strava_sync_status 
SET sync_status = 'completed',
    last_sync_at = NOW(),
    total_activities_synced = (
      SELECT COUNT(*) 
      FROM strava_activities 
      WHERE user_id = 'c87ff11f-3cef-4873-856d-43ba00454c81'
    ),
    last_activity_date = (
      SELECT MAX(start_date) 
      FROM strava_activities 
      WHERE user_id = 'c87ff11f-3cef-4873-856d-43ba00454c81'
    ),
    updated_at = NOW()
WHERE user_id = 'c87ff11f-3cef-4873-856d-43ba00454c81';