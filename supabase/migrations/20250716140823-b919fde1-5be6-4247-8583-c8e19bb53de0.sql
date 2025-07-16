-- Create table for user commitments from AI recommendations
CREATE TABLE public.user_commitments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT,
  target_metric TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_commitments ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own commitments" 
ON public.user_commitments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own commitments" 
ON public.user_commitments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own commitments" 
ON public.user_commitments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own commitments" 
ON public.user_commitments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_commitments_updated_at
BEFORE UPDATE ON public.user_commitments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();