-- Security hardening: Add SET search_path to functions missing it
CREATE OR REPLACE FUNCTION public.deactivate_garmin_user(garmin_user_id_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Deactivate tokens for the Garmin user ID
  UPDATE garmin_tokens 
  SET is_active = false, 
      updated_at = NOW()
  WHERE token_secret LIKE '%' || garmin_user_id_param || '%' 
     OR consumer_key = garmin_user_id_param;
  
  -- Log the deactivation
  RAISE NOTICE 'Deactivated Garmin tokens for user: %', garmin_user_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_sync_user(user_id_param uuid, sync_type_param text, min_interval_minutes integer DEFAULT 5)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  last_sync TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the last sync time for this user and sync type
  SELECT last_sync_at INTO last_sync
  FROM garmin_sync_control
  WHERE user_id = user_id_param 
    AND sync_type = sync_type_param
    AND status = 'completed'
  ORDER BY last_sync_at DESC
  LIMIT 1;
  
  -- If no previous sync, allow it
  IF last_sync IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if enough time has passed
  RETURN (NOW() - last_sync) > (min_interval_minutes * INTERVAL '1 minute');
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_sync_attempt(user_id_param uuid, sync_type_param text, triggered_by_param text, webhook_payload_param jsonb DEFAULT NULL::jsonb, callback_url_param text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  sync_id UUID;
BEGIN
  INSERT INTO garmin_sync_control (
    user_id,
    sync_type,
    triggered_by,
    webhook_payload,
    callback_url,
    status
  ) VALUES (
    user_id_param,
    sync_type_param,
    triggered_by_param,
    webhook_payload_param,
    callback_url_param,
    'pending'
  ) RETURNING id INTO sync_id;
  
  RETURN sync_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_sync_status(sync_id_param uuid, status_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE garmin_sync_control
  SET status = status_param,
      updated_at = NOW(),
      last_sync_at = CASE WHEN status_param = 'completed' THEN NOW() ELSE last_sync_at END
  WHERE id = sync_id_param;
END;
$function$;

-- Update INSERT policies to include explicit WITH CHECK expressions

-- garmin_activities
DROP POLICY IF EXISTS "Users can insert their own activities" ON garmin_activities;
CREATE POLICY "Users can insert their own activities" 
ON garmin_activities 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- garmin_activity_details  
DROP POLICY IF EXISTS "Users can insert their own activity details" ON garmin_activity_details;
CREATE POLICY "Users can insert their own activity details" 
ON garmin_activity_details 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- garmin_backfill_requests
DROP POLICY IF EXISTS "Users can insert their own backfill requests" ON garmin_backfill_requests;
CREATE POLICY "Users can insert their own backfill requests" 
ON garmin_backfill_requests 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- garmin_daily_summaries
DROP POLICY IF EXISTS "Users can insert their own daily summaries" ON garmin_daily_summaries;
CREATE POLICY "Users can insert their own daily summaries" 
ON garmin_daily_summaries 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- garmin_tokens
DROP POLICY IF EXISTS "Users can insert their own garmin tokens" ON garmin_tokens;
CREATE POLICY "Users can insert their own garmin tokens" 
ON garmin_tokens 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- garmin_user_permissions
DROP POLICY IF EXISTS "Users can insert their own permissions" ON garmin_user_permissions;
CREATE POLICY "Users can insert their own permissions" 
ON garmin_user_permissions 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- oauth_temp_tokens
DROP POLICY IF EXISTS "Users can insert their own temp tokens" ON oauth_temp_tokens;
CREATE POLICY "Users can insert their own temp tokens" 
ON oauth_temp_tokens 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- performance_metrics
DROP POLICY IF EXISTS "Users and service role can insert performance metrics" ON performance_metrics;
CREATE POLICY "Users and service role can insert performance metrics" 
ON performance_metrics 
FOR INSERT 
TO authenticated
WITH CHECK ((auth.uid() = user_id) OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- user_commitments
DROP POLICY IF EXISTS "Users can create their own commitments" ON user_commitments;
CREATE POLICY "Users can create their own commitments" 
ON user_commitments 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);