-- Create policies for SECURITY DEFINER functions to upsert
CREATE POLICY "Internal definer can insert variation analysis"
ON public.variation_analysis
FOR INSERT
TO postgres, supabase_admin
WITH CHECK (true);

CREATE POLICY "Internal definer can update variation analysis"
ON public.variation_analysis
FOR UPDATE
TO postgres, supabase_admin
USING (true);

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

-- Attach trigger to activity_chart_cache to recalc on cache build/update
DROP TRIGGER IF EXISTS after_cache_build_variation ON public.activity_chart_cache;
CREATE TRIGGER after_cache_build_variation
AFTER INSERT OR UPDATE OF series
ON public.activity_chart_cache
FOR EACH ROW
WHEN (NEW.series IS NOT NULL AND jsonb_typeof(NEW.series)='array' AND jsonb_array_length(NEW.series) >= 10)
EXECUTE FUNCTION public.trg_variation_analysis_recalc_from_cache();