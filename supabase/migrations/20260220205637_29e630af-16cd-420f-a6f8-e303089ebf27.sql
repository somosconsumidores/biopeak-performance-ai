
CREATE TABLE public.efficiency_fingerprint (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_id text NOT NULL UNIQUE,
  segments jsonb NOT NULL DEFAULT '[]',
  alerts jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  overall_score numeric,
  computed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.efficiency_fingerprint ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own fingerprint" ON public.efficiency_fingerprint
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service insert fingerprint" ON public.efficiency_fingerprint
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update fingerprint" ON public.efficiency_fingerprint
  FOR UPDATE USING (true);
