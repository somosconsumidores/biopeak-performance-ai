-- Fix security warnings for search_path in survey functions
CREATE OR REPLACE FUNCTION check_max_questions_per_campaign()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.survey_questions WHERE campaign_id = NEW.campaign_id) >= 2 THEN
    RAISE EXCEPTION 'Maximum of 2 questions allowed per campaign';
  END IF;
  RETURN NEW;
END;
$$;