
-- 1) Tabela para cache de gráficos de atividades
create table if not exists public.activity_chart_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  activity_source text not null,
  activity_id text not null,
  version integer not null default 1,
  -- série amostrada já pronta para o frontend (ex.: [{distance_km, pace_min_km, heart_rate, speed_kmh, ts?}, ...])
  series jsonb not null default '[]'::jsonb,
  -- zonas de FC pré-calculadas (ex.: [{zone, label, minHR, maxHR, timeSec, percent, color?}, ...])
  zones jsonb,
  -- estatísticas resumidas (ex.: {avg_hr, avg_pace_min_km, distance_km, duration_sec, hr_max, ...})
  stats jsonb,
  built_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- status de construção do cache: 'pending' | 'ready' | 'error'
  build_status text not null default 'ready',
  error_message text,
  constraint activity_chart_cache_source_chk
    check (activity_source in ('garmin','polar','strava','gpx'))
);

-- 2) Unicidade por usuário+fonte+atividade+versão
create unique index if not exists activity_chart_cache_unique
  on public.activity_chart_cache (user_id, activity_source, activity_id, version);

-- 3) Índices auxiliares
create index if not exists idx_activity_chart_cache_user
  on public.activity_chart_cache (user_id);

create index if not exists idx_activity_chart_cache_lookup
  on public.activity_chart_cache (activity_source, activity_id);

-- 4) RLS
alter table public.activity_chart_cache enable row level security;

-- Permissões: service_role pode gerenciar tudo (para Edge Functions com service role)
create policy "Service role can manage chart cache"
  on public.activity_chart_cache
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Usuários só veem/alteram seus próprios registros
create policy "Users can view their own chart cache"
  on public.activity_chart_cache
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chart cache"
  on public.activity_chart_cache
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own chart cache"
  on public.activity_chart_cache
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own chart cache"
  on public.activity_chart_cache
  for delete
  using (auth.uid() = user_id);

-- 5) Trigger de updated_at (usa a função já existente public.update_updated_at_column)
drop trigger if exists set_timestamp_activity_chart_cache on public.activity_chart_cache;
create trigger set_timestamp_activity_chart_cache
before update on public.activity_chart_cache
for each row
execute function public.update_updated_at_column();
