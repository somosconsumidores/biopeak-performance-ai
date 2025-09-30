-- Create table for single AI analysis purchases
CREATE TABLE public.ai_analysis_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  activity_source TEXT NOT NULL DEFAULT 'garmin',
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 499,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  purchased_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_analysis_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view their own ai analysis purchases"
ON public.ai_analysis_purchases
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own purchases
CREATE POLICY "Users can insert their own ai analysis purchases"
ON public.ai_analysis_purchases
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Service role can manage all purchases
CREATE POLICY "Service role can manage all ai analysis purchases"
ON public.ai_analysis_purchases
FOR ALL
TO service_role
USING (true);

-- Create index for faster queries
CREATE INDEX idx_ai_analysis_purchases_user_activity 
ON public.ai_analysis_purchases(user_id, activity_id, activity_source);

-- Create index for Stripe payment intent lookups
CREATE INDEX idx_ai_analysis_purchases_stripe_payment 
ON public.ai_analysis_purchases(stripe_payment_intent_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_ai_analysis_purchases_updated_at
BEFORE UPDATE ON public.ai_analysis_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();