-- Create GPX storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('gpx', 'gpx', false)
on conflict (id) do nothing;

-- Storage policies for 'gpx' bucket: path convention '<user_id>/<filename>.gpx'
-- Allow owners to read their own GPX files
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and polname = 'GPX owners can read their files'
  ) then
    create policy "GPX owners can read their files"
      on storage.objects
      for select
      using (
        bucket_id = 'gpx' and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- Allow owners to upload their own GPX files
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and polname = 'GPX owners can upload files'
  ) then
    create policy "GPX owners can upload files"
      on storage.objects
      for insert
      with check (
        bucket_id = 'gpx' and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- Allow owners to update their own GPX files
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and polname = 'GPX owners can update files'
  ) then
    create policy "GPX owners can update files"
      on storage.objects
      for update
      using (
        bucket_id = 'gpx' and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- Allow owners to delete their own GPX files
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and polname = 'GPX owners can delete files'
  ) then
    create policy "GPX owners can delete files"
      on storage.objects
      for delete
      using (
        bucket_id = 'gpx' and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- Create tables for Strava GPX Activities
create table if not exists public.strava_gpx_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  activity_id text not null,
  name text,
  activity_type text,
  start_time timestamptz,
  distance_in_meters double precision,
  duration_in_seconds integer,
  total_elevation_gain_in_meters double precision,
  total_elevation_loss_in_meters double precision,
  average_heart_rate integer,
  max_heart_rate integer,
  average_speed_mps double precision,
  average_pace_min_km numeric,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_gpx_activities_user_activity
  on public.strava_gpx_activities(user_id, activity_id);

alter table public.strava_gpx_activities enable row level security;

-- Policies for strava_gpx_activities
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'strava_gpx_activities' and polname = 'Users can view their own gpx activities'
  ) then
    create policy "Users can view their own gpx activities"
      on public.strava_gpx_activities
      for select
      using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'strava_gpx_activities' and polname = 'Users can insert their own gpx activities'
  ) then
    create policy "Users can insert their own gpx activities"
      on public.strava_gpx_activities
      for insert
      with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'strava_gpx_activities' and polname = 'Users can update their own gpx activities'
  ) then
    create policy "Users can update their own gpx activities"
      on public.strava_gpx_activities
      for update
      using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'strava_gpx_activities' and polname = 'Users can delete their own gpx activities'
  ) then
    create policy "Users can delete their own gpx activities"
      on public.strava_gpx_activities
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- Details table for GPX trackpoints
create table if not exists public.strava_gpx_activity_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  activity_id text not null,
  sample_timestamp timestamptz,
  latitude_in_degree double precision,
  longitude_in_degree double precision,
  elevation_in_meters double precision,
  heart_rate integer,
  total_distance_in_meters double precision,
  speed_meters_per_second double precision,
  created_at timestamptz not null default now()
);

create index if not exists idx_gpx_details_activity on public.strava_gpx_activity_details(activity_id);
create index if not exists idx_gpx_details_user_activity on public.strava_gpx_activity_details(user_id, activity_id);
create index if not exists idx_gpx_details_timestamp on public.strava_gpx_activity_details(sample_timestamp);

alter table public.strava_gpx_activity_details enable row level security;

-- Policies for details
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'strava_gpx_activity_details' and polname = 'Users can view their own gpx details'
  ) then
    create policy "Users can view their own gpx details"
      on public.strava_gpx_activity_details
      for select
      using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'strava_gpx_activity_details' and polname = 'Users can insert their own gpx details'
  ) then
    create policy "Users can insert their own gpx details"
      on public.strava_gpx_activity_details
      for insert
      with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'strava_gpx_activity_details' and polname = 'Users can update their own gpx details'
  ) then
    create policy "Users can update their own gpx details"
      on public.strava_gpx_activity_details
      for update
      using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'strava_gpx_activity_details' and polname = 'Users can delete their own gpx details'
  ) then
    create policy "Users can delete their own gpx details"
      on public.strava_gpx_activity_details
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;