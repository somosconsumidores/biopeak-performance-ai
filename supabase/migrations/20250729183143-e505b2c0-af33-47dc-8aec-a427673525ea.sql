-- Disable the remaining cron job that might be triggering webhooks
SELECT cron.unschedule('process-orphaned-webhooks');

-- Clear any orphaned webhooks that might reference the problematic token
DELETE FROM garmin_orphaned_webhooks 
WHERE webhook_payload::text LIKE '%fdbb553c-f18c-4e68-a641-16911a8580ef%';