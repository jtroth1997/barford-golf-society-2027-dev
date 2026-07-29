-- Automatic 2027 leaderboard membership.
-- Safe to run more than once. Historical scores are never deleted.

alter table public.profiles
  add column if not exists leaderboard_active boolean not null default true,
  add column if not exists leaderboard_from_round integer not null default 1;

update public.profiles
set leaderboard_active = coalesce(leaderboard_active, true),
    leaderboard_from_round = greatest(coalesce(leaderboard_from_round, 1), 1);

create or replace function public.next_eligible_round()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(round_number) filter (
    where season = 2027
      and (locked = true or (played_on is not null and played_on <= current_date))
  ), 0) + 1
  from public.rounds;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, email, phone, leaderboard_active, leaderboard_from_round
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Member'),
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    true,
    public.next_eligible_round()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.set_member_leaderboard_access(
  target_user_id uuid,
  make_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'Member account not found.';
  end if;

  update public.profiles
  set leaderboard_active = make_active,
      leaderboard_from_round = case
        when make_active and leaderboard_active = false then public.next_eligible_round()
        else leaderboard_from_round
      end,
      updated_at = now()
  where id = target_user_id;
end;
$$;

revoke all on function public.set_member_leaderboard_access(uuid, boolean) from public;
grant execute on function public.set_member_leaderboard_access(uuid, boolean) to authenticated;

create or replace function public.get_2027_leaderboard_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'season', 2027,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.full_name,
        'startingHandicap', coalesce(p.handicap, 0),
        'currentHandicap', coalesce((
          select s.next_handicap
          from public.scores s
          join public.rounds lr on lr.id = s.round_id
          where s.member_id = p.id and lr.season = 2027
          order by lr.round_number desc limit 1
        ), p.handicap, 0),
        'fromRound', p.leaderboard_from_round
      ) order by p.full_name)
      from public.profiles p
      where p.leaderboard_active = true
    ), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'number', r.round_number,
        'name', r.name,
        'date', r.played_on,
        'locked', r.locked,
        'results', coalesce((
          select jsonb_agg(jsonb_build_object(
            'playerId', s.member_id,
            'handicapUsed', s.handicap_used,
            'points', s.points,
            'adjustment', s.adjustment,
            'nextHandicap', s.next_handicap,
            'dnp', s.dnp
          ) order by s.created_at)
          from public.scores s where s.round_id = r.id
        ), '[]'::jsonb)
      ) order by r.round_number)
      from public.rounds r where r.season = 2027
    ), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(item)
      from (
        select jsonb_build_object('playerId', s.member_id, 'roundId', s.round_id, 'type', x.kind) item
        from public.scores s
        join public.rounds r on r.id = s.round_id
        cross join lateral (
          values
            ('win', s.winner),
            ('runnerUp', s.runner_up),
            ('third', s.third_place),
            ('nearestPin', s.nearest_pin),
            ('longestDrive', s.longest_drive)
        ) x(kind, earned)
        where r.season = 2027 and x.earned = true
      ) earned_items
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_2027_leaderboard_snapshot() from public;
grant execute on function public.get_2027_leaderboard_snapshot() to authenticated;
