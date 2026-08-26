-- Complete required golf details during first account creation.
-- Applied to project xspzmthygrajzktydvvj on 2026-08-26.

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_category text := new.raw_user_meta_data->>'playing_category';
  requested_handicap numeric := nullif(new.raw_user_meta_data->>'handicap','')::numeric;
begin
  if requested_category not in ('men','women') then
    raise exception 'A playing category is required to create a Barford Golf Society account';
  end if;
  if requested_handicap is null or requested_handicap < 0 or requested_handicap > 54 then
    raise exception 'A starting society handicap between 0 and 54 is required to create a Barford Golf Society account';
  end if;

  insert into public.profiles (
    id, full_name, email, phone, playing_category, handicap,
    leaderboard_active, leaderboard_from_round
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Member'),
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    requested_category,
    requested_handicap,
    true,
    public.next_eligible_round()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;