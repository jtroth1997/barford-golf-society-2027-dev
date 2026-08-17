-- Event-day competition markers. Safe to run more than once.
alter table public.event_holes add column if not exists longest_drive boolean not null default false;
alter table public.event_holes add column if not exists nearest_pin boolean not null default false;

create unique index if not exists event_holes_one_longest_drive
  on public.event_holes(event_id) where longest_drive;
create unique index if not exists event_holes_one_nearest_pin
  on public.event_holes(event_id) where nearest_pin;

comment on column public.event_holes.longest_drive is 'Shows the Longest Drive event alert on this hole.';
comment on column public.event_holes.nearest_pin is 'Shows the Nearest the Pin event alert on this hole.';
