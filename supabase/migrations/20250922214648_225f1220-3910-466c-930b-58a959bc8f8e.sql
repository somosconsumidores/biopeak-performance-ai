-- Delete the existing chart data to force fresh calculation
DELETE FROM activity_chart_data 
WHERE activity_id = 'A7A4C8D9-4FB9-4D79-A177-BDD8319884D0' 
  AND activity_source = 'healthkit';