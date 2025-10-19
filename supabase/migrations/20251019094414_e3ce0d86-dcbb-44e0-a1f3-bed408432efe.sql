-- Enable HTTP extension for making external requests
create extension if not exists http;

-- Function to notify n8n webhook when phone is updated
create or replace function public.notify_phone_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Send POST request to n8n webhook with user data
  perform net.http_post(
    url := 'https://biopeak-ai.app.n8n.cloud/webhook/new-user-whatsapp',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'user_id', NEW.id,
      'display_name', NEW.display_name,
      'old_phone', OLD.phone,
      'new_phone', NEW.phone
    )
  );
  
  return NEW;
end;
$$;

-- Drop existing trigger if exists
drop trigger if exists on_phone_update_trigger on public.profiles;

-- Create trigger that fires after phone update
create trigger on_phone_update_trigger
  after update of phone on public.profiles
  for each row
  when (OLD.phone is distinct from NEW.phone)
  execute function public.notify_phone_update();