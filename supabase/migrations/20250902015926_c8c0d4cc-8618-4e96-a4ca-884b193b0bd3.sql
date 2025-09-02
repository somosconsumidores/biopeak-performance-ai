-- Create idempotency log table for email sends
create table if not exists public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  template_key text not null,
  user_id uuid,
  metadata jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Ensure only one send per (email, template)
create unique index if not exists uq_sent_emails_email_template on public.sent_emails (email, template_key);

-- Enable RLS (edge functions use service role and bypass RLS)
alter table public.sent_emails enable row level security;