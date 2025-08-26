-- Harden functions created in previous migration by setting immutable search_path
CREATE OR REPLACE FUNCTION public.set_training_plan_deleted_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status IN ('cancelled','deleted') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_workouts_when_plan_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status IN ('cancelled','deleted') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.training_plan_workouts
    SET status = 'cancelled', updated_at = now()
    WHERE plan_id = NEW.id AND status <> 'completed';
  END IF;
  RETURN NEW;
END;
$$;