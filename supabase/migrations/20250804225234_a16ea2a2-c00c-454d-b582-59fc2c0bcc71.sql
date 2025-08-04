-- Create polar_sleep table for storing Polar sleep data
CREATE TABLE public.polar_sleep (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  polar_user_id BIGINT,
  date DATE NOT NULL,
  sleep_score INTEGER,
  sleep_charge INTEGER,
  sleep_start_time TIMESTAMP WITH TIME ZONE,
  sleep_end_time TIMESTAMP WITH TIME ZONE,
  total_sleep INTEGER, -- em segundos
  sleep_goal INTEGER, -- em segundos  
  sleep_deficit INTEGER, -- em segundos
  sleep_efficiency NUMERIC(5,2), -- percentual
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.polar_sleep ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own polar sleep data" 
ON public.polar_sleep 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own polar sleep data" 
ON public.polar_sleep 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own polar sleep data" 
ON public.polar_sleep 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own polar sleep data" 
ON public.polar_sleep 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_polar_sleep_updated_at
BEFORE UPDATE ON public.polar_sleep
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();