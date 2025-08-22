-- Ensure internal policies allow SECURITY DEFINER function to upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='variation_analysis' 
      AND polname='Internal definer can insert variation analysis'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Internal definer can insert variation analysis"
      ON public.variation_analysis
      FOR INSERT
      TO postgres, supabase_admin
      WITH CHECK (true);
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='variation_analysis' 
      AND polname='Internal definer can update variation analysis'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Internal definer can update variation analysis"
      ON public.variation_analysis
      FOR UPDATE
      TO postgres, supabase_admin
      USING (true);
    $$;
  END IF;
END$$;

-- Trigger function to recalc from chart cache (uses activity_source dynamically)
CREATE OR REPLACE FUNCTION public.trg_variation_analysis_recalc_from_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.calculate_variation_analysis(NEW.user_id, NEW.activity_source, NEW.activity_id);
  RETURN NEW;
END;
$$;

-- Attach trigger to garmin_activity_details (uses existing function that hardcodes 'garmin')
DROP TRIGGER IF EXISTS after_gad_recalc_variation ON public.garmin_activity_details;
CREATE TRIGGER after_gad_recalc_variation
AFTER INSERT OR UPDATE
ON public.garmin_activity_details
FOR EACH ROW
EXECUTE FUNCTION public.trg_variation_analysis_recalc();

-- Attach trigger to activity_chart_cache to recalc on cache build/update
DROP TRIGGER IF EXISTS after_cache_build_variation ON public.activity_chart_cache;
CREATE TRIGGER after_cache_build_variation
AFTER INSERT OR UPDATE OF series
ON public.activity_chart_cache
FOR EACH ROW
WHEN (NEW.series IS NOT NULL)
EXECUTE FUNCTION public.trg_variation_analysis_recalc_from_cache();

-- One-time backfill for all cached activities with sufficient series length
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT user_id, activity_source, activity_id
    FROM public.activity_chart_cache
    WHERE jsonb_typeof(series)='array' AND jsonb_array_length(series) >= 10
  LOOP
    PERFORM public.calculate_variation_analysis(r.user_id, r.activity_source, r.activity_id);
  END LOOP;
END$$;