-- Criar função para obter estatísticas públicas da aplicação
CREATE OR REPLACE FUNCTION public.get_app_stats()
RETURNS TABLE(
  total_athletes integer,
  total_activities integer, 
  total_insights integer,
  total_goals integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    (SELECT count(*)::integer FROM public.profiles) as total_athletes,
    (
      (SELECT count(*)::integer FROM public.garmin_activities) +
      (SELECT count(*)::integer FROM public.strava_activities) + 
      (SELECT count(*)::integer FROM public.polar_activities)
    ) as total_activities,
    (SELECT count(*)::integer FROM public.performance_metrics) as total_insights,
    (SELECT count(*)::integer FROM public.user_commitments) as total_goals;
$function$;

-- Permitir acesso público à função
GRANT EXECUTE ON FUNCTION public.get_app_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_app_stats() TO authenticated;