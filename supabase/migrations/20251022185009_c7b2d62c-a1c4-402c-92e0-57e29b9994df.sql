-- Create health declarations table for legal protection
CREATE TABLE public.health_declarations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_plan_id UUID NULL,
  
  -- PAR-Q Questions (true = SIM, false = NÃO)
  question_1_heart_problem BOOLEAN NOT NULL,
  question_2_chest_pain_during_activity BOOLEAN NOT NULL,
  question_3_chest_pain_last_3months BOOLEAN NOT NULL,
  question_4_balance_consciousness_loss BOOLEAN NOT NULL,
  question_5_bone_joint_problem BOOLEAN NOT NULL,
  question_6_taking_medication BOOLEAN NOT NULL,
  question_7_other_impediment BOOLEAN NOT NULL,
  question_8_additional_info TEXT NULL,
  
  -- Declaration acceptance
  declaration_accepted BOOLEAN NOT NULL,
  
  -- Eligibility (true if all questions are false/NO)
  is_eligible BOOLEAN NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.health_declarations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own health declarations"
  ON public.health_declarations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own health declarations"
  ON public.health_declarations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all health declarations"
  ON public.health_declarations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create index for faster queries
CREATE INDEX idx_health_declarations_user_id ON public.health_declarations(user_id);
CREATE INDEX idx_health_declarations_created_at ON public.health_declarations(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_health_declarations_updated_at
  BEFORE UPDATE ON public.health_declarations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();