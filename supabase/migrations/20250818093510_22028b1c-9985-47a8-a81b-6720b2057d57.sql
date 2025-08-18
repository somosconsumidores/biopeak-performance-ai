
-- Reprocessa todos os payloads user_metrics e atualiza garmin_vo2max
create or replace function public.reprocess_all_user_metrics_vo2max()
returns table(processed_logs integer, inserted_rows integer, updated_rows integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_processed integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  -- Autorização: permitir service_role ou admin.
  -- Se chamado internamente (sem JWT), permite também.
  if coalesce(current_setting('request.jwt.claims', true), '') <> '' then
    if (auth.jwt() ->> 'role') is distinct from 'service_role'
       and not public.has_role(auth.uid(), 'admin') then
      raise exception 'not authorized';
    end if;
  end if;

  with parsed as (
    select
      l.garmin_user_id,
      (l.payload->>'calendarDate')::date as calendar_date,
      -- Prioriza vo2MaxRunning; fallback para vo2Max/VO2MAX
      coalesce(
        nullif(l.payload->>'vo2MaxRunning','')::numeric,
        nullif(l.payload->>'vo2Max','')::numeric,
        nullif(l.payload->>'VO2MAX','')::numeric
      ) as vo2_run,
      nullif(l.payload->>'vo2MaxCycling','')::numeric as vo2_cycle,
      nullif(l.payload->>'fitnessAge','')::int as fitness_age
    from public.garmin_webhook_logs l
    where l.webhook_type = 'user_metrics'
      and l.garmin_user_id is not null
      and (l.payload ? 'calendarDate')
  ),
  counts as (
    select count(*)::int as c from parsed
  )
  select c into v_processed from counts;

  -- Insere linhas ausentes
  insert into public.garmin_vo2max (garmin_user_id, calendar_date, vo2_max_running, vo2_max_cycling, fitness_age)
  select p.garmin_user_id, p.calendar_date, p.vo2_run, p.vo2_cycle, p.fitness_age
  from parsed p
  left join public.garmin_vo2max v
    on v.garmin_user_id = p.garmin_user_id
   and v.calendar_date = p.calendar_date
  where v.id is null
    and (p.vo2_run is not null or p.vo2_cycle is not null or p.fitness_age is not null);
  get diagnostics v_inserted = row_count;

  -- Atualiza apenas campos nulos com dados do payload
  update public.garmin_vo2max v
  set 
    vo2_max_running = coalesce(v.vo2_max_running, p.vo2_run),
    vo2_max_cycling = coalesce(v.vo2_max_cycling, p.vo2_cycle),
    fitness_age = coalesce(v.fitness_age, p.fitness_age)
  from parsed p
  where v.garmin_user_id = p.garmin_user_id
    and v.calendar_date = p.calendar_date
    and (
      (v.vo2_max_running is null and p.vo2_run is not null) or
      (v.vo2_max_cycling is null and p.vo2_cycle is not null) or
      (v.fitness_age is null and p.fitness_age is not null)
    );
  get diagnostics v_updated = row_count;

  return query select v_processed, v_inserted, v_updated;
end;
$function$;

-- Índice auxiliar (opcional) para acelerar a leitura dos logs de user_metrics
create index if not exists idx_garmin_webhook_logs_user_metrics
  on public.garmin_webhook_logs (webhook_type, garmin_user_id);
