-- Allow 'draft' and 'archived' statuses for training_plans.status
DO $$
DECLARE r record;
BEGIN
  -- Drop any existing CHECK constraints on training_plans that reference status
  FOR r IN 
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'training_plans'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.training_plans DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Recreate a consistent status check constraint
ALTER TABLE public.training_plans
  ADD CONSTRAINT training_plans_status_check
  CHECK (status IN ('draft','pending','active','cancelled','deleted','archived'));
