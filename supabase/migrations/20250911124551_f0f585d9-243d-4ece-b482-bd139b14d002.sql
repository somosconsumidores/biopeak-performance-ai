-- Create HealthKit activities table
CREATE TABLE public.healthkit_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  healthkit_uuid text NOT NULL,
  activity_type text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  duration_seconds integer,
  distance_meters numeric,
  active_calories integer,
  total_calories integer,
  average_heart_rate integer,
  max_heart_rate integer,
  steps integer,
  elevation_gain_meters numeric,
  elevation_loss_meters numeric,
  pace_min_per_km numeric,
  activity_date date,
  source_name text,
  device_name text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, healthkit_uuid)
);

-- Create HealthKit sync status table
CREATE TABLE public.healthkit_sync_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sync_status text NOT NULL DEFAULT 'never_synced',
  last_sync_at timestamp with time zone,
  activities_synced integer DEFAULT 0,
  error_message text,
  permissions_granted boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.healthkit_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthkit_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for healthkit_activities
CREATE POLICY "Users can view their own healthkit activities"
ON public.healthkit_activities FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own healthkit activities"
ON public.healthkit_activities FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own healthkit activities"
ON public.healthkit_activities FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own healthkit activities"
ON public.healthkit_activities FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage healthkit activities"
ON public.healthkit_activities FOR ALL
USING (auth.role() = 'service_role');

-- RLS Policies for healthkit_sync_status
CREATE POLICY "Users can view their own healthkit sync status"
ON public.healthkit_sync_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own healthkit sync status"
ON public.healthkit_sync_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own healthkit sync status"
ON public.healthkit_sync_status FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage healthkit sync status"
ON public.healthkit_sync_status FOR ALL
USING (auth.role() = 'service_role');

-- Trigger to auto-populate all_activities from healthkit_activities
CREATE OR REPLACE FUNCTION public._ins_all_from_healthkit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  v_minutes := CASE WHEN NEW.duration_seconds IS NOT NULL THEN NEW.duration_seconds/60.0 ELSE NULL END;
  v_pace := CASE WHEN NEW.distance_meters IS NOT NULL AND NEW.distance_meters > 0 AND v_minutes IS NOT NULL
           THEN v_minutes / (NEW.distance_meters/1000.0) ELSE NULL END;
  v_activity_date := CASE WHEN NEW.start_time IS NOT NULL THEN (NEW.start_time AT TIME ZONE 'UTC')::date ELSE NULL END;

  INSERT INTO public.all_activities (
    user_id, activity_id, activity_type, activity_date,
    total_distance_meters, total_time_minutes,
    device_name, active_kilocalories,
    average_heart_rate, max_heart_rate,
    pace_min_per_km, total_elevation_gain_in_meters, total_elevation_loss_in_meters,
    activity_source
  )
  VALUES (
    NEW.user_id, NEW.healthkit_uuid, NEW.activity_type, v_activity_date,
    NEW.distance_meters, v_minutes,
    NEW.device_name, NEW.active_calories,
    NEW.average_heart_rate, NEW.max_heart_rate,
    v_pace, NEW.elevation_gain_meters, NEW.elevation_loss_meters,
    'healthkit'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
  RETURN NEW;
END;$function$;

-- Create trigger
CREATE TRIGGER trigger_ins_all_from_healthkit
  AFTER INSERT ON public.healthkit_activities
  FOR EACH ROW
  EXECUTE FUNCTION public._ins_all_from_healthkit();