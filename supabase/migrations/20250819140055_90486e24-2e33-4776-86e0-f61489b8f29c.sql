-- Tabela para definições de conquistas
CREATE TABLE public.achievement_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  achievement_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'award',
  color TEXT NOT NULL DEFAULT 'blue',
  category TEXT NOT NULL DEFAULT 'general',
  difficulty TEXT NOT NULL DEFAULT 'easy',
  points INTEGER NOT NULL DEFAULT 10,
  requirement_type TEXT NOT NULL, -- 'total_activities', 'distance_milestone', 'pace_improvement', etc.
  requirement_value NUMERIC,
  requirement_metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para conquistas dos usuários
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  progress_value NUMERIC DEFAULT 0,
  is_seen BOOLEAN NOT NULL DEFAULT false,
  seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

-- Tabela para progresso de conquistas
CREATE TABLE public.achievement_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_key TEXT NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

-- Enable RLS
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_progress ENABLE ROW LEVEL SECURITY;

-- Policies for achievement_definitions (public read)
CREATE POLICY "Achievement definitions are viewable by everyone" 
ON public.achievement_definitions 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage achievement definitions" 
ON public.achievement_definitions 
FOR ALL 
USING (auth.role() = 'service_role');

-- Policies for user_achievements
CREATE POLICY "Users can view their own achievements" 
ON public.user_achievements 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" 
ON public.user_achievements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements" 
ON public.user_achievements 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all achievements" 
ON public.user_achievements 
FOR ALL 
USING (auth.role() = 'service_role');

-- Policies for achievement_progress
CREATE POLICY "Users can view their own progress" 
ON public.achievement_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" 
ON public.achievement_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" 
ON public.achievement_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all progress" 
ON public.achievement_progress 
FOR ALL 
USING (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE TRIGGER update_achievement_definitions_updated_at
BEFORE UPDATE ON public.achievement_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_achievements_updated_at
BEFORE UPDATE ON public.user_achievements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_achievement_progress_updated_at
BEFORE UPDATE ON public.achievement_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir conquistas padrão
INSERT INTO public.achievement_definitions (achievement_key, title, description, icon, color, category, difficulty, points, requirement_type, requirement_value) VALUES
('first_activity', 'Primeira Atividade', 'Complete sua primeira atividade registrada', 'play', 'green', 'inicio', 'easy', 10, 'total_activities', 1),
('activity_streak_3', 'Consistência Inicial', 'Complete atividades por 3 dias consecutivos', 'calendar', 'blue', 'consistencia', 'easy', 15, 'activity_streak', 3),
('activity_streak_7', 'Uma Semana Forte', 'Complete atividades por 7 dias consecutivos', 'calendar-check', 'purple', 'consistencia', 'medium', 25, 'activity_streak', 7),
('activity_streak_30', 'Máquina Imparável', 'Complete atividades por 30 dias consecutivos', 'calendar-heart', 'gold', 'consistencia', 'hard', 100, 'activity_streak', 30),
('total_activities_10', 'Pegando o Ritmo', 'Complete 10 atividades no total', 'activity', 'blue', 'volume', 'easy', 20, 'total_activities', 10),
('total_activities_50', 'Atleta Dedicado', 'Complete 50 atividades no total', 'trophy', 'purple', 'volume', 'medium', 50, 'total_activities', 50),
('total_activities_100', 'Centurião', 'Complete 100 atividades no total', 'crown', 'gold', 'volume', 'hard', 100, 'total_activities', 100),
('distance_marathon', 'Maratonista', 'Complete uma distância de 42km em uma única atividade', 'flag', 'gold', 'distancia', 'hard', 150, 'single_distance', 42000),
('distance_10k', 'Primeira Dezena', 'Complete 10km em uma única atividade', 'target', 'green', 'distancia', 'easy', 30, 'single_distance', 10000),
('distance_21k', 'Meia Maratona', 'Complete 21km em uma única atividade', 'award', 'purple', 'distancia', 'medium', 75, 'single_distance', 21000),
('total_distance_100k', 'Explorador', 'Acumule 100km de distância total', 'map', 'blue', 'volume', 'medium', 40, 'total_distance', 100000),
('total_distance_500k', 'Viajante', 'Acumule 500km de distância total', 'plane', 'purple', 'volume', 'hard', 80, 'total_distance', 500000),
('pace_sub_5', 'Velocista', 'Mantenha um pace abaixo de 5:00 min/km por pelo menos 5km', 'zap', 'gold', 'velocidade', 'hard', 120, 'pace_achievement', 5),
('early_bird', 'Madrugador', 'Complete 5 atividades antes das 7h da manhã', 'sunrise', 'orange', 'horario', 'medium', 35, 'early_activities', 5),
('night_owl', 'Coruja Noturna', 'Complete 5 atividades após as 21h', 'moon', 'blue', 'horario', 'medium', 35, 'night_activities', 5);