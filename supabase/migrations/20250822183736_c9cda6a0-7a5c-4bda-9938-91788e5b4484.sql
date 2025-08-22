-- Fase 1: Criação de Tabelas Otimizadas para substituir o uso direto de garmin_activity_details

-- 1. Tabela para dados de gráficos (substitui processamento pesado no frontend)
CREATE TABLE public.activity_chart_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  activity_source TEXT NOT NULL DEFAULT 'garmin',
  
  -- Dados da série temporal otimizados
  series_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Estatísticas pré-calculadas
  total_distance_meters NUMERIC,
  duration_seconds INTEGER,
  avg_pace_min_km NUMERIC,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_speed_ms NUMERIC,
  
  -- Metadados
  data_points_count INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, activity_source, activity_id)
);

-- 2. Tabela para segmentos de 1km (elimina cálculo em tempo real)
CREATE TABLE public.activity_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  activity_source TEXT NOT NULL DEFAULT 'garmin',
  
  -- Dados do segmento
  segment_number INTEGER NOT NULL,
  start_distance_meters NUMERIC NOT NULL,
  end_distance_meters NUMERIC NOT NULL,
  
  -- Métricas calculadas
  avg_pace_min_km NUMERIC,
  avg_heart_rate INTEGER,
  avg_speed_ms NUMERIC,
  duration_seconds INTEGER,
  elevation_gain_meters NUMERIC,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, activity_source, activity_id, segment_number)
);

-- 3. Tabela para zonas de frequência cardíaca (elimina cálculo complexo)
CREATE TABLE public.activity_heart_rate_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  activity_source TEXT NOT NULL DEFAULT 'garmin',
  
  -- Configuração das zonas
  max_heart_rate INTEGER NOT NULL,
  
  -- Zonas e tempo em cada uma (em segundos)
  zone_1_time_seconds INTEGER DEFAULT 0, -- 50-60%
  zone_2_time_seconds INTEGER DEFAULT 0, -- 60-70%
  zone_3_time_seconds INTEGER DEFAULT 0, -- 70-80%
  zone_4_time_seconds INTEGER DEFAULT 0, -- 80-90%
  zone_5_time_seconds INTEGER DEFAULT 0, -- 90-100%
  
  -- Zonas e percentuais
  zone_1_percentage NUMERIC DEFAULT 0,
  zone_2_percentage NUMERIC DEFAULT 0,
  zone_3_percentage NUMERIC DEFAULT 0,
  zone_4_percentage NUMERIC DEFAULT 0,
  zone_5_percentage NUMERIC DEFAULT 0,
  
  -- Metadados
  total_time_seconds INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, activity_source, activity_id)
);

-- 4. Tabela para coordenadas GPS otimizadas (sampling inteligente)
CREATE TABLE public.activity_coordinates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  activity_source TEXT NOT NULL DEFAULT 'garmin',
  
  -- Coordenadas sampleadas e otimizadas
  coordinates JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Estatísticas da rota
  total_points INTEGER NOT NULL DEFAULT 0,
  sampled_points INTEGER NOT NULL DEFAULT 0,
  starting_latitude NUMERIC,
  starting_longitude NUMERIC,
  bounding_box JSONB, -- {north, south, east, west}
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, activity_source, activity_id)
);

-- 5. Tabela para métricas de variação (substitui cálculo complexo)
CREATE TABLE public.activity_variation_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_id TEXT NOT NULL,
  activity_source TEXT NOT NULL DEFAULT 'garmin',
  
  -- Dados de entrada
  data_points INTEGER NOT NULL DEFAULT 0,
  
  -- Coeficientes de variação
  heart_rate_cv NUMERIC,
  heart_rate_cv_category TEXT, -- 'Baixo' | 'Alto'
  pace_cv NUMERIC,
  pace_cv_category TEXT, -- 'Baixo' | 'Alto'
  
  -- Análise
  diagnosis TEXT,
  has_valid_data BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, activity_source, activity_id)
);

-- Índices para performance
CREATE INDEX idx_activity_chart_data_user_source ON public.activity_chart_data(user_id, activity_source);
CREATE INDEX idx_activity_chart_data_activity ON public.activity_chart_data(activity_id);

CREATE INDEX idx_activity_segments_user_source ON public.activity_segments(user_id, activity_source);
CREATE INDEX idx_activity_segments_activity ON public.activity_segments(activity_id);

CREATE INDEX idx_activity_hr_zones_user_source ON public.activity_heart_rate_zones(user_id, activity_source);
CREATE INDEX idx_activity_hr_zones_activity ON public.activity_heart_rate_zones(activity_id);

CREATE INDEX idx_activity_coordinates_user_source ON public.activity_coordinates(user_id, activity_source);
CREATE INDEX idx_activity_coordinates_activity ON public.activity_coordinates(activity_id);

CREATE INDEX idx_activity_variation_user_source ON public.activity_variation_analysis(user_id, activity_source);
CREATE INDEX idx_activity_variation_activity ON public.activity_variation_analysis(activity_id);

-- RLS Policies
ALTER TABLE public.activity_chart_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_heart_rate_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_coordinates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_variation_analysis ENABLE ROW LEVEL SECURITY;

-- Policies para activity_chart_data
CREATE POLICY "Users can view their own chart data" ON public.activity_chart_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chart data" ON public.activity_chart_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chart data" ON public.activity_chart_data
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage chart data" ON public.activity_chart_data
  FOR ALL USING (auth.role() = 'service_role');

-- Policies para activity_segments
CREATE POLICY "Users can view their own segments" ON public.activity_segments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own segments" ON public.activity_segments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage segments" ON public.activity_segments
  FOR ALL USING (auth.role() = 'service_role');

-- Policies para activity_heart_rate_zones
CREATE POLICY "Users can view their own hr zones" ON public.activity_heart_rate_zones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hr zones" ON public.activity_heart_rate_zones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage hr zones" ON public.activity_heart_rate_zones
  FOR ALL USING (auth.role() = 'service_role');

-- Policies para activity_coordinates
CREATE POLICY "Users can view their own coordinates" ON public.activity_coordinates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coordinates" ON public.activity_coordinates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage coordinates" ON public.activity_coordinates
  FOR ALL USING (auth.role() = 'service_role');

-- Policies para activity_variation_analysis
CREATE POLICY "Users can view their own variation analysis" ON public.activity_variation_analysis
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own variation analysis" ON public.activity_variation_analysis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own variation analysis" ON public.activity_variation_analysis
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage variation analysis" ON public.activity_variation_analysis
  FOR ALL USING (auth.role() = 'service_role');

-- Triggers para updated_at
CREATE TRIGGER update_activity_chart_data_updated_at
  BEFORE UPDATE ON public.activity_chart_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activity_variation_analysis_updated_at
  BEFORE UPDATE ON public.activity_variation_analysis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();