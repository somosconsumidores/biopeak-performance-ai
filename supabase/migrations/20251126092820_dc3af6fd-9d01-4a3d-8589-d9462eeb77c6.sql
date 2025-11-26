-- Delete all Strava activities for user ad92eb44-61c7-4b56-95c6-f3d89a3e6001
DELETE FROM all_activities 
WHERE user_id = 'ad92eb44-61c7-4b56-95c6-f3d89a3e6001' 
AND activity_source = 'strava';