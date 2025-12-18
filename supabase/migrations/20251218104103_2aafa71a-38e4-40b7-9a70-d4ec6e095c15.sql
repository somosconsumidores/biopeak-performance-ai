-- Fase 1: Limpeza de dados duplicados para garmin_user_id = '052d657b-ec41-405b-9749-2d18271c7597'

-- 1. Desativar tokens antigos (manter apenas o do sandro.leao ativo)
UPDATE garmin_tokens 
SET is_active = false, updated_at = now()
WHERE garmin_user_id = '052d657b-ec41-405b-9749-2d18271c7597'
  AND user_id != '54290109-f7cc-4e73-9c35-70243ba15e6b';

-- 2. Corrigir user_id em activity_chart_data para a atividade 21288078102
UPDATE activity_chart_data 
SET user_id = '54290109-f7cc-4e73-9c35-70243ba15e6b', updated_at = now()
WHERE activity_id = '21288078102' 
  AND user_id != '54290109-f7cc-4e73-9c35-70243ba15e6b';

-- 3. Corrigir user_id em activity_coordinates
UPDATE activity_coordinates 
SET user_id = '54290109-f7cc-4e73-9c35-70243ba15e6b'
WHERE activity_id = '21288078102' 
  AND user_id != '54290109-f7cc-4e73-9c35-70243ba15e6b';

-- 4. Corrigir user_id em activity_segments
UPDATE activity_segments 
SET user_id = '54290109-f7cc-4e73-9c35-70243ba15e6b'
WHERE activity_id = '21288078102' 
  AND user_id != '54290109-f7cc-4e73-9c35-70243ba15e6b';

-- 5. Corrigir user_id em activity_heart_rate_zones
UPDATE activity_heart_rate_zones 
SET user_id = '54290109-f7cc-4e73-9c35-70243ba15e6b'
WHERE activity_id = '21288078102' 
  AND user_id != '54290109-f7cc-4e73-9c35-70243ba15e6b';

-- 6. Corrigir user_id em activity_best_segments
UPDATE activity_best_segments 
SET user_id = '54290109-f7cc-4e73-9c35-70243ba15e6b', updated_at = now()
WHERE activity_id = '21288078102' 
  AND user_id != '54290109-f7cc-4e73-9c35-70243ba15e6b';

-- 7. Corrigir user_id em activity_variation_analysis
UPDATE activity_variation_analysis 
SET user_id = '54290109-f7cc-4e73-9c35-70243ba15e6b', updated_at = now()
WHERE activity_id = '21288078102' 
  AND user_id != '54290109-f7cc-4e73-9c35-70243ba15e6b';