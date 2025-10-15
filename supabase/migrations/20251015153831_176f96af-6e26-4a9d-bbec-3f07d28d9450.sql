-- Função SQL que retorna estatísticas semanais agregadas por atleta
-- Junta all_activities com profiles para obter email e display_name
create or replace function weekly_summary_stats(start_date date, end_date date)
returns table (
  user_id uuid,
  email text,
  display_name text,
  total_km numeric,
  activities_count bigint,
  active_days bigint,
  calories numeric
) 
language sql 
stable
security definer
set search_path = public
as $$
  select
    a.user_id,
    p.email,
    p.display_name,
    round((sum(a.total_distance_meters)/1000.0)::numeric, 2) as total_km,
    count(*) as activities_count,
    count(distinct a.activity_date) as active_days,
    sum(a.active_kilocalories)::numeric as calories
  from all_activities a
  join profiles p on p.user_id = a.user_id
  where a.activity_date between start_date and end_date
  group by a.user_id, p.email, p.display_name
  order by total_km desc;
$$;