-- Force reprocessing by updating the HealthKit activity record
UPDATE healthkit_activities 
SET updated_at = now()
WHERE healthkit_uuid = 'A7A4C8D9-4FB9-4D79-A177-BDD8319884D0';