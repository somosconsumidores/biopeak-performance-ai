-- Normalize affiliates_login.phone to: 55 + DDD + number (digits only)

CREATE OR REPLACE FUNCTION public.affiliates_normalize_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  digits text;
BEGIN
  IF NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  digits := regexp_replace(NEW.phone, '\D', '', 'g');

  IF digits IS NULL OR digits = '' THEN
    NEW.phone := NULL;
    RETURN NEW;
  END IF;

  -- Already includes Brazil country code
  IF left(digits, 2) = '55' THEN
    NEW.phone := digits;
    RETURN NEW;
  END IF;

  -- DDD (2) + number (8 or 9) => 10 or 11 digits
  IF length(digits) = 10 OR length(digits) = 11 THEN
    NEW.phone := '55' || digits;
    RETURN NEW;
  END IF;

  -- Fallback: keep digits-only to avoid breaking writes
  NEW.phone := digits;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliates_normalize_phone ON public.affiliates_login;

CREATE TRIGGER trg_affiliates_normalize_phone
BEFORE INSERT OR UPDATE OF phone ON public.affiliates_login
FOR EACH ROW
EXECUTE FUNCTION public.affiliates_normalize_phone();

-- Normalize existing phone numbers
UPDATE affiliates_login 
SET phone = phone 
WHERE phone IS NOT NULL;