
-- Insere o profile do usuário caso ainda não exista
insert into public.profiles (user_id, display_name, email)
select 
  u.id as user_id,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)) as display_name,
  u.email
from auth.users u
where u.id = '11c23f7e-e7a2-4d73-be1a-066aca0045ba'
  and not exists (
    select 1 from public.profiles p where p.user_id = u.id
  );
