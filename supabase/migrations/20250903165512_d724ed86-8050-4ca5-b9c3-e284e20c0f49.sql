
-- Índice para acelerar as leituras por usuário e data, incluindo as colunas lidas pela função
-- Assim o Postgres pode fazer index-only scans quando possível
CREATE INDEX IF NOT EXISTS all_activities_user_date_incl
ON public.all_activities (user_id, activity_date)
INCLUDE (total_time_minutes, average_heart_rate, max_heart_rate);
