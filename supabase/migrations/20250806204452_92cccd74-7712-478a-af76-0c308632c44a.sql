-- Create table for sleep feedback analysis
CREATE TABLE public.sleep_feedback_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_text TEXT NOT NULL,
  sleep_data JSONB NOT NULL,
  overtraining_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sleep_feedback_analysis ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own sleep feedback analysis" 
ON public.sleep_feedback_analysis 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sleep feedback analysis" 
ON public.sleep_feedback_analysis 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sleep feedback analysis" 
ON public.sleep_feedback_analysis 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sleep feedback analysis" 
ON public.sleep_feedback_analysis 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sleep_feedback_analysis_updated_at
BEFORE UPDATE ON public.sleep_feedback_analysis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();