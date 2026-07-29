-- 2027 Admin control-centre additions.
-- Safe to run more than once. This affects only project xspzmthygrajzktydvvj.

alter table public.profiles
  add column if not exists committee_contacted boolean not null default false;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(8,2) not null default 0,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.world_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  video_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.world_event_votes (
  id uuid primary key default gen_random_uuid(),
  world_event_id uuid not null references public.world_events(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  unique (world_event_id, member_id)
);

alter table public.products enable row level security;
alter table public.world_events enable row level security;
alter table public.world_event_votes enable row level security;

drop policy if exists "Everyone reads active products" on public.products;
create policy "Everyone reads active products" on public.products
  for select using (active = true or public.is_admin());
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Everyone reads active world events" on public.world_events;
create policy "Everyone reads active world events" on public.world_events
  for select using (active = true or public.is_admin());
drop policy if exists "Admins manage world events" on public.world_events;
create policy "Admins manage world events" on public.world_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Members read world event votes" on public.world_event_votes;
create policy "Members read world event votes" on public.world_event_votes
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
drop policy if exists "Members cast world event votes" on public.world_event_votes;
create policy "Members cast world event votes" on public.world_event_votes
  for insert to authenticated with check (member_id = auth.uid());
drop policy if exists "Members update world event votes" on public.world_event_votes;
create policy "Members update world event votes" on public.world_event_votes
  for update to authenticated using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());
drop policy if exists "Admins delete world event votes" on public.world_event_votes;
create policy "Admins delete world event votes" on public.world_event_votes
  for delete to authenticated using (public.is_admin());
