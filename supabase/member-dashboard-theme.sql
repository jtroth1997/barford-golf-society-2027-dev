-- Member-owned personal dashboard colours.
-- Existing profile RLS already limits ordinary members to updating their own row.

alter table public.profiles
  add column if not exists theme_primary text not null default '#315C4A',
  add column if not exists theme_accent text not null default '#C7A96B';

alter table public.profiles
  drop constraint if exists profiles_theme_primary_hex,
  drop constraint if exists profiles_theme_accent_hex,
  add constraint profiles_theme_primary_hex check (theme_primary ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint profiles_theme_accent_hex check (theme_accent ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_category text := new.raw_user_meta_data->>'playing_category';
  requested_handicap numeric := nullif(new.raw_user_meta_data->>'handicap','')::numeric;
  requested_primary text := coalesce(nullif(new.raw_user_meta_data->>'theme_primary',''), '#315C4A');
  requested_accent text := coalesce(nullif(new.raw_user_meta_data->>'theme_accent',''), '#C7A96B');
begin
  if requested_category not in ('men','women') then
    raise exception 'A playing category is required to create a Barford Golf Society account';
  end if;
  if requested_handicap is null or requested_handicap < 0 or requested_handicap > 54 then
    raise exception 'A starting society handicap between 0 and 54 is required to create a Barford Golf Society account';
  end if;
  if requested_primary !~ '^#[0-9A-Fa-f]{6}$' or requested_accent !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Dashboard colours must be six-digit hex colours';
  end if;

  insert into public.profiles (
    id, full_name, email, phone, playing_category, handicap,
    leaderboard_active, leaderboard_from_round, theme_primary, theme_accent
  ) values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Member'),
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    requested_category,
    requested_handicap,
    true,
    public.next_eligible_round(),
    upper(requested_primary),
    upper(requested_accent)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on column public.profiles.theme_primary is 'Member-selected primary interface colour.';
comment on column public.profiles.theme_accent is 'Member-selected accent interface colour.';
