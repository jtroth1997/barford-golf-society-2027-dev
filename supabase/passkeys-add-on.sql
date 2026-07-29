-- Run once in the NEW 2027 Supabase project only.
-- This does not access or change the live 2026 project.
create table if not exists public.passkey_credentials (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_type text,
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkey_credentials_user_idx on public.passkey_credentials(user_id);
alter table public.passkey_credentials enable row level security;

create table if not exists public.passkey_challenges (
  challenge text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('register', 'login')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.passkey_challenges enable row level security;
