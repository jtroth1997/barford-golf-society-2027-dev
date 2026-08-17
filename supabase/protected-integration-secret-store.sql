create table if not exists public.integration_secrets (
  name text primary key,
  secret_value text not null,
  updated_at timestamptz not null default now()
);
alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from anon, authenticated;
grant select on public.integration_secrets to service_role;
comment on table public.integration_secrets is 'Server-only integration secrets. No browser role has access.';
notify pgrst, 'reload schema';
