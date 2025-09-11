-- Create HealthKit sync status table (if not exists)
CREATE TABLE IF NOT EXISTS public.healthkit_sync_status (
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

-- Create RLS policies (with IF NOT EXISTS checks)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'healthkit_sync_status' AND policyname = 'Users can view their own healthkit sync status') THEN
    CREATE POLICY "Users can view their own healthkit sync status" 
    ON public.healthkit_sync_status 
    FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'healthkit_sync_status' AND policyname = 'Users can insert their own healthkit sync status') THEN
    CREATE POLICY "Users can insert their own healthkit sync status" 
    ON public.healthkit_sync_status 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'healthkit_sync_status' AND policyname = 'Users can update their own healthkit sync status') THEN
    CREATE POLICY "Users can update their own healthkit sync status" 
    ON public.healthkit_sync_status 
    FOR UPDATE 
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'healthkit_sync_status' AND policyname = 'Service role can manage all healthkit sync status') THEN
    CREATE POLICY "Service role can manage all healthkit sync status" 
    ON public.healthkit_sync_status 
    FOR ALL 
    USING (auth.role() = 'service_role'::text)
    WITH CHECK (auth.role() = 'service_role'::text);
  END IF;
END $$;