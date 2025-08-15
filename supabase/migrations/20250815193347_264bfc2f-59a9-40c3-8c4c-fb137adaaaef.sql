-- Create survey system tables

-- Survey campaigns table
CREATE TABLE public.survey_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Survey questions table (max 2 questions per campaign)
CREATE TABLE public.survey_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.survey_campaigns(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('text', 'multiple_choice', 'scale')),
  options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Survey responses table
CREATE TABLE public.survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.survey_campaigns(id) ON DELETE CASCADE,
  user_id UUID,
  question_id UUID NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  response_text TEXT,
  response_option TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Survey user interactions table (to ensure single display)
CREATE TABLE public.survey_user_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.survey_campaigns(id) ON DELETE CASCADE,
  user_id UUID,
  shown_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK (action IN ('responded', 'dismissed')),
  ip_address TEXT,
  UNIQUE(campaign_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.survey_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_user_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for survey_campaigns
CREATE POLICY "Admins can manage survey campaigns" ON public.survey_campaigns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active campaigns" ON public.survey_campaigns
  FOR SELECT USING (is_active = true AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE);

-- RLS policies for survey_questions
CREATE POLICY "Admins can manage survey questions" ON public.survey_questions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view questions from active campaigns" ON public.survey_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.survey_campaigns sc 
      WHERE sc.id = survey_questions.campaign_id 
        AND sc.is_active = true 
        AND sc.start_date <= CURRENT_DATE 
        AND sc.end_date >= CURRENT_DATE
    )
  );

-- RLS policies for survey_responses
CREATE POLICY "Admins can view all responses" ON public.survey_responses
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create their own responses" ON public.survey_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for survey_user_interactions
CREATE POLICY "Admins can view all interactions" ON public.survey_user_interactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create their own interactions" ON public.survey_user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own interactions" ON public.survey_user_interactions
  FOR SELECT USING (auth.uid() = user_id);

-- Add constraint to limit questions per campaign to 2
CREATE OR REPLACE FUNCTION check_max_questions_per_campaign()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.survey_questions WHERE campaign_id = NEW.campaign_id) >= 2 THEN
    RAISE EXCEPTION 'Maximum of 2 questions allowed per campaign';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_questions
  BEFORE INSERT ON public.survey_questions
  FOR EACH ROW
  EXECUTE FUNCTION check_max_questions_per_campaign();

-- Create indexes for performance
CREATE INDEX idx_survey_campaigns_active ON public.survey_campaigns (is_active, start_date, end_date);
CREATE INDEX idx_survey_questions_campaign ON public.survey_questions (campaign_id, order_index);
CREATE INDEX idx_survey_responses_campaign_user ON public.survey_responses (campaign_id, user_id);
CREATE INDEX idx_survey_interactions_campaign_user ON public.survey_user_interactions (campaign_id, user_id);