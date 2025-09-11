-- Create HealthKit activities table
CREATE TABLE public.healthkit_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  activity_type TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_in_seconds INTEGER,
  distance_in_meters NUMERIC,
  active_kilocalories INTEGER,
  average_heart_rate_in_beats_per_minute INTEGER,
  max_heart_rate_in_beats_per_minute INTEGER,
  device_name TEXT,
  source_name TEXT DEFAULT 'HealthKit',
  raw_data JSONB DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

-- Enable RLS
ALTER TABLE public.healthkit_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own healthkit activities" 
ON public.healthkit_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own healthkit activities" 
ON public.healthkit_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own healthkit activities" 
ON public.healthkit_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own healthkit activities" 
ON public.healthkit_activities 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all healthkit activities" 
ON public.healthkit_activities 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Create HealthKit sync status table
CREATE TABLE public.healthkit_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  activities_synced INTEGER DEFAULT 0,
  total_activities INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.healthkit_sync_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own healthkit sync status" 
ON public.healthkit_sync_status 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own healthkit sync status" 
ON public.healthkit_sync_status 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own healthkit sync status" 
ON public.healthkit_sync_status 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all healthkit sync status" 
ON public.healthkit_sync_status 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Create trigger for inserting into all_activities from healthkit_activities
CREATE OR REPLACE FUNCTION public._ins_all_from_healthkit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  v_minutes double precision;
  v_pace double precision;
  v_activity_date date;
BEGIN
  v_minutes := CASE WHEN NEW.duration_in_seconds IS NOT NULL THEN NEW.duration_in_seconds/60.0 ELSE NULL END;
  v_pace := CASE WHEN NEW.distance_in_meters IS NOT NULL AND NEW.distance_in_meters > 0 AND v_minutes IS NOT NULL
           THEN v_minutes / (NEW.distance_in_meters/1000.0) ELSE NULL END;
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
    NEW.user_id, NEW.activity_id, NEW.activity_type, v_activity_date,
    NEW.distance_in_meters, v_minutes,
    NEW.device_name, NEW.active_kilocalories,
    NEW.average_heart_rate_in_beats_per_minute, NEW.max_heart_rate_in_beats_per_minute,
    v_pace, NULL, NULL,
    'healthkit'
  )
  ON CONFLICT (user_id, activity_source, activity_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Create trigger
CREATE TRIGGER healthkit_to_all_activities_trigger
AFTER INSERT ON public.healthkit_activities
FOR EACH ROW
EXECUTE FUNCTION public._ins_all_from_healthkit();