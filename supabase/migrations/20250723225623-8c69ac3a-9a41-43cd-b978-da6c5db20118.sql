-- Trigger manual initial sync for user sandro.oficial06@teste.com
-- Force initial sync to be triggered by setting initial_sync_completed to false and calling the function

UPDATE garmin_tokens 
SET initial_sync_completed = false 
WHERE user_id = '69d46588-92a4-4a38-9abc-4071348d7c6a';