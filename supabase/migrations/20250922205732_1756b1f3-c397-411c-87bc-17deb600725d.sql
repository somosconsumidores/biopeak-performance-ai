-- Try to directly call the HealthKit chart processing trigger function
SELECT trg_process_chart_after_insert_healthkit() 
FROM healthkit_activities 
WHERE healthkit_uuid = 'A7A4C8D9-4FB9-4D79-A177-BDD8319884D0' 
LIMIT 1;