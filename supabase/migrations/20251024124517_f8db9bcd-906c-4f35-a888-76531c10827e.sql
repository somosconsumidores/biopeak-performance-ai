-- ========================================
-- BioPeak Personal Coach WhatsApp System
-- ========================================

-- 1) Add phone column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text;

CREATE INDEX IF NOT EXISTS idx_profiles_phone 
ON public.profiles(phone) 
WHERE phone IS NOT NULL;

COMMENT ON COLUMN public.profiles.phone IS 'Normalized phone format: 55DDDNNNNNNNN (Brazil)';

-- 2) Create coach_threads table (conversation state)
CREATE TABLE IF NOT EXISTS public.coach_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  phone text NOT NULL,
  provider text DEFAULT 'zaap' CHECK (provider IN ('zaap', 'gupshup', 'twilio')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_intent text DEFAULT 'idle',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, plan_id)
);

-- Indexes for coach_threads
CREATE INDEX IF NOT EXISTS idx_coach_threads_user_id 
ON public.coach_threads(user_id);

CREATE INDEX IF NOT EXISTS idx_coach_threads_plan_id 
ON public.coach_threads(plan_id);

CREATE INDEX IF NOT EXISTS idx_coach_threads_phone 
ON public.coach_threads(phone);

CREATE INDEX IF NOT EXISTS idx_coach_threads_last_message 
ON public.coach_threads(last_message_at DESC);

COMMENT ON TABLE public.coach_threads IS 'Stores WhatsApp coaching conversation state per user/plan';
COMMENT ON COLUMN public.coach_threads.context IS 'Cached plan summary and upcoming workouts (60-90 days)';
COMMENT ON COLUMN public.coach_threads.last_intent IS 'Current conversation state: idle | awaiting_new_date | confirming_reschedule';

-- RLS for coach_threads
ALTER TABLE public.coach_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coach threads"
  ON public.coach_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage coach threads"
  ON public.coach_threads FOR ALL
  USING (auth.role() = 'service_role');

-- 3) Create coach_events table (event log)
CREATE TABLE IF NOT EXISTS public.coach_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  phone text,
  event_type text NOT NULL,
  message_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for coach_events
CREATE INDEX IF NOT EXISTS idx_coach_events_user_id 
ON public.coach_events(user_id);

CREATE INDEX IF NOT EXISTS idx_coach_events_plan_id 
ON public.coach_events(plan_id);

CREATE INDEX IF NOT EXISTS idx_coach_events_type 
ON public.coach_events(event_type);

CREATE INDEX IF NOT EXISTS idx_coach_events_created_at 
ON public.coach_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_events_message_id 
ON public.coach_events(message_id) 
WHERE message_id IS NOT NULL;

COMMENT ON TABLE public.coach_events IS 'Audit log for all WhatsApp coaching interactions';
COMMENT ON COLUMN public.coach_events.event_type IS 'Event types: welcome | reminder | done_marked | reschedule | qa | delivery_failed | followup';
COMMENT ON COLUMN public.coach_events.message_id IS 'WhatsApp message ID for idempotency checks';

-- RLS for coach_events
ALTER TABLE public.coach_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coach events"
  ON public.coach_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage coach events"
  ON public.coach_events FOR ALL
  USING (auth.role() = 'service_role');

-- 4) Helper function: Get tomorrow's scheduled workouts for reminders
CREATE OR REPLACE FUNCTION public.get_tomorrow_workouts_for_reminder()
RETURNS TABLE (
  workout_id uuid,
  user_id uuid,
  plan_id uuid,
  workout_date date,
  title text,
  description text,
  workout_type text,
  distance_meters integer,
  target_pace_min_km numeric,
  phone text,
  provider text,
  display_name text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT 
    tpw.id as workout_id,
    tpw.user_id,
    tpw.plan_id,
    tpw.workout_date,
    tpw.title,
    tpw.description,
    tpw.workout_type,
    tpw.distance_meters,
    tpw.target_pace_min_km,
    ct.phone,
    ct.provider,
    p.display_name
  FROM training_plan_workouts tpw
  JOIN coach_threads ct ON ct.plan_id = tpw.plan_id AND ct.user_id = tpw.user_id
  JOIN profiles p ON p.user_id = tpw.user_id
  WHERE tpw.workout_date = CURRENT_DATE + INTERVAL '1 day'
    AND tpw.status = 'planned'
    AND ct.phone IS NOT NULL
    AND p.phone IS NOT NULL
  ORDER BY tpw.user_id;
$$;

COMMENT ON FUNCTION public.get_tomorrow_workouts_for_reminder IS 'Used by n8n daily reminder CRON at 18:00';

-- 5) Helper function: Get today's incomplete workouts for followup
CREATE OR REPLACE FUNCTION public.get_today_incomplete_workouts()
RETURNS TABLE (
  workout_id uuid,
  user_id uuid,
  plan_id uuid,
  workout_date date,
  title text,
  phone text,
  display_name text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT 
    tpw.id as workout_id,
    tpw.user_id,
    tpw.plan_id,
    tpw.workout_date,
    tpw.title,
    ct.phone,
    p.display_name
  FROM training_plan_workouts tpw
  JOIN coach_threads ct ON ct.plan_id = tpw.plan_id AND ct.user_id = tpw.user_id
  JOIN profiles p ON p.user_id = tpw.user_id
  WHERE tpw.workout_date = CURRENT_DATE
    AND tpw.status = 'planned'
    AND ct.phone IS NOT NULL
    AND p.phone IS NOT NULL
  ORDER BY tpw.user_id;
$$;

COMMENT ON FUNCTION public.get_today_incomplete_workouts IS 'Used by n8n post-workout followup CRON at 21:00';