create table if not exists public.event_hole_views (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  tee_lat numeric, tee_lng numeric, green_lat numeric, green_lng numeric,
  hazards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique(event_id,hole_number)
);
alter table public.event_hole_views enable row level security;
grant select,insert,update,delete on public.event_hole_views to authenticated;
create policy "Admins manage hole views" on public.event_hole_views for all to authenticated using (public.is_admin()) with check (public.is_admin());