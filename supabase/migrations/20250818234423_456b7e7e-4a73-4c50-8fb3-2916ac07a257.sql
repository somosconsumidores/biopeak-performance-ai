-- Ensure RLS is enabled
ALTER TABLE public.garmin_vo2max ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT their own VO2Max via active garmin_tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'garmin_vo2max' 
      AND policyname = 'Users can view their own vo2max via tokens'
  ) THEN
    CREATE POLICY "Users can view their own vo2max via tokens"
    ON public.garmin_vo2max
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 
        FROM public.garmin_tokens gt
        WHERE gt.garmin_user_id = garmin_vo2max.garmin_user_id
          AND gt.user_id = auth.uid()
          AND gt.is_active = true
      )
    );
  END IF;
END $$;

-- Also allow via garmin_user_mapping as a fallback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'garmin_vo2max' 
      AND policyname = 'Users can view their vo2max via mapping'
  ) THEN
    CREATE POLICY "Users can view their vo2max via mapping"
    ON public.garmin_vo2max
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 
        FROM public.garmin_user_mapping gum
        WHERE gum.garmin_user_id = garmin_vo2max.garmin_user_id
          AND gum.user_id = auth.uid()
          AND gum.is_active = true
      )
    );
  END IF;
END $$;