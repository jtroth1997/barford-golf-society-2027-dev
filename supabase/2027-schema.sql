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
grant execute on function public.is_admin() to anon, authenticated;

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

-- Prevent members from promoting themselves through the otherwise legitimate
-- "update my own profile" permission.
create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
    and session_user not in ('postgres', 'supabase_admin')
    and not public.is_admin() then
    raise exception 'Administrator access can only be changed by an administrator.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_admin_flag on public.profiles;
create trigger protect_profile_admin_flag
  before update on public.profiles
  for each row execute function public.protect_profile_admin_flag();

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
drop policy if exists "Signed-in members read profile images" on storage.objects;
create policy "Signed-in members read profile images" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-images');
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

-- Private passkey data. No browser-facing policies: only the passkey Edge Function
-- accesses these tables using the 2027 project's service role.
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

create table if not exists public.admin_role_audit (
  id bigint generated by default as identity primary key,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  member_id uuid not null references public.profiles(id) on delete restrict,
  granted boolean not null,
  created_at timestamptz not null default now()
);
create table if not exists public.legacy_member_links (
  member_id uuid primary key references public.profiles(id) on delete cascade,
  legacy_name text unique,
  confirmed boolean not null default false,
  declined_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.legacy_member_links enable row level security;
drop policy if exists "Members read own legacy link" on public.legacy_member_links;
create policy "Members read own legacy link" on public.legacy_member_links
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
drop policy if exists "Members create own legacy link" on public.legacy_member_links;
create policy "Members create own legacy link" on public.legacy_member_links
  for insert to authenticated with check (member_id = auth.uid());
drop policy if exists "Members update own legacy link" on public.legacy_member_links;
create policy "Members update own legacy link" on public.legacy_member_links
  for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
alter table public.admin_role_audit enable row level security;
drop policy if exists "Admins read role history" on public.admin_role_audit;
create policy "Admins read role history" on public.admin_role_audit
  for select to authenticated using (public.is_admin());

create or replace function public.set_member_admin_access(
  target_user_id uuid,
  grant_access boolean,
  confirmation_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles%rowtype;
  admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  select * into target_profile from public.profiles where id = target_user_id;
  if not found then raise exception 'Member account not found.'; end if;
  if lower(trim(confirmation_name)) <> lower(trim(target_profile.full_name)) then
    raise exception 'The confirmation name did not match.';
  end if;
  if not grant_access and target_user_id = auth.uid() then
    raise exception 'You cannot remove your own administrator access.';
  end if;
  select count(*) into admin_count from public.profiles where is_admin = true;
  if not grant_access and target_profile.is_admin and admin_count <= 1 then
    raise exception 'The final administrator cannot be removed.';
  end if;
  update public.profiles set is_admin = grant_access, updated_at = now()
    where id = target_user_id;
  insert into public.admin_role_audit (changed_by, member_id, granted)
    values (auth.uid(), target_user_id, grant_access);
end;
$$;
revoke all on function public.set_member_admin_access(uuid, boolean, text) from public;
grant execute on function public.set_member_admin_access(uuid, boolean, text) to authenticated;
