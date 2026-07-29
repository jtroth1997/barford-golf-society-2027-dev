-- Barford Golf Society 2027
-- This schema belongs ONLY to project xspzmthygrajzktydvvj.
-- It does not read from, write to, or reference the 2026 project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  photo_url text,
  home_club text,
  handicap numeric(4,1),
  playing_preference text not null default 'walker'
    check (playing_preference in ('walker', 'buggy', 'either')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text not null,
  address text,
  event_date date not null,
  first_tee_time time,
  price numeric(8,2),
  capacity integer check (capacity is null or capacity > 0),
  latitude numeric,
  longitude numeric,
  course_video_url text,
  notes text,
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'playing'
    check (status in ('playing', 'not_playing', 'reserve', 'cancelled')),
  payment_status text not null default 'payment_due'
    check (payment_status in ('payment_due', 'paid', 'refunded', 'waived')),
  buggy_requested boolean not null default false,
  preferred_tee_time text,
  guest_name text,
  guest_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create table if not exists public.tee_times (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  tee_time time not null,
  tee_number integer not null default 1,
  position integer not null check (position between 1 and 4),
  member_id uuid references public.profiles(id) on delete cascade,
  guest_name text,
  created_at timestamptz not null default now(),
  unique (event_id, tee_time, tee_number, position)
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid unique references public.events(id) on delete set null,
  season integer not null default 2027,
  round_number integer not null,
  name text not null,
  played_on date,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (season, round_number)
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  handicap_used numeric(4,1),
  points integer,
  adjustment numeric(4,1),
  next_handicap numeric(4,1),
  dnp boolean not null default false,
  winner boolean not null default false,
  runner_up boolean not null default false,
  third_place boolean not null default false,
  nearest_pin boolean not null default false,
  longest_drive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, member_id)
);

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  uploaded_by uuid references public.profiles(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  caption text,
  taken_at timestamptz,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Member'),
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data->>'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.tee_times enable row level security;
alter table public.rounds enable row level security;
alter table public.scores enable row level security;
alter table public.gallery_photos enable row level security;

drop policy if exists "Members read own profile" on public.profiles;
create policy "Members read own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "Members update own profile" on public.profiles;
create policy "Members update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Everyone can read scheduled content" on public.events;
create policy "Everyone can read scheduled content" on public.events
  for select using (status <> 'draft' or public.is_admin());
drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Members read own RSVP" on public.rsvps;
create policy "Members read own RSVP" on public.rsvps
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
drop policy if exists "Members create own RSVP" on public.rsvps;
create policy "Members create own RSVP" on public.rsvps
  for insert to authenticated with check (member_id = auth.uid());
drop policy if exists "Members update own RSVP" on public.rsvps;
create policy "Members update own RSVP" on public.rsvps
  for update to authenticated using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());
drop policy if exists "Admins delete RSVPs" on public.rsvps;
create policy "Admins delete RSVPs" on public.rsvps
  for delete to authenticated using (public.is_admin());

drop policy if exists "Members read own tee time" on public.tee_times;
create policy "Members read own tee time" on public.tee_times
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
drop policy if exists "Admins manage tee times" on public.tee_times;
create policy "Admins manage tee times" on public.tee_times
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Everyone reads rounds" on public.rounds;
create policy "Everyone reads rounds" on public.rounds for select using (true);
drop policy if exists "Admins manage rounds" on public.rounds;
create policy "Admins manage rounds" on public.rounds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Everyone reads scores" on public.scores;
create policy "Everyone reads scores" on public.scores for select using (true);
drop policy if exists "Admins manage scores" on public.scores;
create policy "Admins manage scores" on public.scores
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Everyone reads approved gallery photos" on public.gallery_photos;
create policy "Everyone reads approved gallery photos" on public.gallery_photos
  for select using (approved = true or public.is_admin());
drop policy if exists "Members add gallery photos" on public.gallery_photos;
create policy "Members add gallery photos" on public.gallery_photos
  for insert to authenticated with check (uploaded_by = auth.uid());
drop policy if exists "Admins manage gallery photos" on public.gallery_photos;
create policy "Admins manage gallery photos" on public.gallery_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gallery-images', 'gallery-images', true, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('profile-images', 'profile-images', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated members upload gallery images" on storage.objects;
create policy "Authenticated members upload gallery images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gallery-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Members update own gallery images" on storage.objects;
create policy "Members update own gallery images" on storage.objects
  for update to authenticated
  using (bucket_id = 'gallery-images' and (owner_id = auth.uid()::text or public.is_admin()))
  with check (bucket_id = 'gallery-images' and (owner_id = auth.uid()::text or public.is_admin()));
drop policy if exists "Members delete own gallery images" on storage.objects;
create policy "Members delete own gallery images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery-images' and (owner_id = auth.uid()::text or public.is_admin()));

drop policy if exists "Members upload own profile image" on storage.objects;
create policy "Members upload own profile image" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Members read own profile image" on storage.objects;
create policy "Members read own profile image" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
drop policy if exists "Members manage own profile image" on storage.objects;
create policy "Members manage own profile image" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'profile-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  )
  with check (
    bucket_id = 'profile-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
