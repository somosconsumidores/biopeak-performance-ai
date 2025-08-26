-- Training plans: add audit + target time range and enforce statuses
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS target_time_minutes_min integer,
  ADD COLUMN IF NOT EXISTS target_time_minutes_max integer;

-- Enforce allowed status values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_plans_status_check'
  ) THEN
    ALTER TABLE public.training_plans
      ADD CONSTRAINT training_plans_status_check
      CHECK (status IN ('active','completed','cancelled','deleted'));
  END IF;
END $$;

-- Set deleted_at automatically when status becomes cancelled/deleted
CREATE OR REPLACE FUNCTION public.set_training_plan_deleted_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('cancelled','deleted') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_training_plan_deleted_at'
  ) THEN
    CREATE TRIGGER trg_set_training_plan_deleted_at
    BEFORE UPDATE ON public.training_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.set_training_plan_deleted_at();
  END IF;
END $$;

-- When a plan is cancelled/deleted, cancel non-completed workouts
CREATE OR REPLACE FUNCTION public.cancel_workouts_when_plan_cancelled()
RETURNS trigger
LANGUAGE plpgsql
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cancel_workouts_when_plan_cancelled'
  ) THEN
    CREATE TRIGGER trg_cancel_workouts_when_plan_cancelled
    AFTER UPDATE ON public.training_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.cancel_workouts_when_plan_cancelled();
  END IF;
END $$;

-- Helpful index for lookups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname = 'idx_training_plans_user_status' AND n.nspname='public'
  ) THEN
    CREATE INDEX idx_training_plans_user_status ON public.training_plans (user_id, status);
  END IF;
END $$;