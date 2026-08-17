-- Offline-first event scoring for Barford Golf Society 2027.
-- Apply to project xspzmthygrajzktydvvj only.

create table if not exists public.event_holes (
  event_id uuid not null references public.events(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  par integer not null check (par between 3 and 6),
  yards integer check (yards is null or yards between 40 and 800),
  stroke_index integer not null check (stroke_index between 1 and 18),
  primary key (event_id, hole_number),
  unique (event_id, stroke_index)
);

create table if not exists public.event_scorecards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  tee_time time not null,
  tee_number integer not null default 1,
  scorer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'ready' check (status in ('ready','in_progress','submitted','locked')),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (event_id, tee_time, tee_number)
);

create table if not exists public.event_scorecard_players (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.event_scorecards(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  handicap_used integer not null check (handicap_used between 0 and 54),
  position integer not null check (position between 1 and 4),
  unique (scorecard_id, member_id),
  unique (scorecard_id, position)
);

create table if not exists public.event_hole_scores (
  scorecard_player_id uuid not null references public.event_scorecard_players(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  strokes integer check (strokes is null or strokes between 1 and 20),
  picked_up boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (scorecard_player_id, hole_number),
  check ((picked_up and strokes is null) or (not picked_up and strokes is not null))
);

alter table public.event_holes enable row level security;
alter table public.event_scorecards enable row level security;
alter table public.event_scorecard_players enable row level security;
alter table public.event_hole_scores enable row level security;

create or replace function public.is_scorecard_group_member(target_scorecard_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_scorecard_players
    where scorecard_id = target_scorecard_id and member_id = auth.uid()
  );
$$;
revoke all on function public.is_scorecard_group_member(uuid) from public, anon;
grant execute on function public.is_scorecard_group_member(uuid) to authenticated;

drop policy if exists "Members read event holes" on public.event_holes;
create policy "Members read event holes" on public.event_holes for select to authenticated using (true);
drop policy if exists "Admins manage event holes" on public.event_holes;
create policy "Admins manage event holes" on public.event_holes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Group reads own scorecard" on public.event_scorecards;
create policy "Group reads own scorecard" on public.event_scorecards for select to authenticated
  using (public.is_admin() or public.is_scorecard_group_member(id));
drop policy if exists "Admins manage scorecards" on public.event_scorecards;
create policy "Admins manage scorecards" on public.event_scorecards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Group reads scorecard players" on public.event_scorecard_players;
create policy "Group reads scorecard players" on public.event_scorecard_players for select to authenticated
  using (public.is_admin() or public.is_scorecard_group_member(scorecard_id));
drop policy if exists "Admins manage scorecard players" on public.event_scorecard_players;
create policy "Admins manage scorecard players" on public.event_scorecard_players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Group reads hole scores" on public.event_hole_scores;
create policy "Group reads hole scores" on public.event_hole_scores for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.event_scorecard_players p
    where p.id = scorecard_player_id and public.is_scorecard_group_member(p.scorecard_id)
  ));
drop policy if exists "Admins manage hole scores" on public.event_hole_scores;
create policy "Admins manage hole scores" on public.event_hole_scores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Snapshot the tee groups and the society handicap that applies to this round.
create or replace function public.prepare_event_scorecards(target_event_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare created_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if (select count(*) from public.event_holes where event_id = target_event_id) <> 18 then
    raise exception 'All 18 holes must be entered first';
  end if;
  if not exists (select 1 from public.tee_times where event_id = target_event_id and member_id is not null) then
    raise exception 'Publish tee times before preparing scorecards';
  end if;

  insert into public.event_scorecards (event_id, tee_time, tee_number)
  select distinct event_id, tee_time, tee_number from public.tee_times
  where event_id = target_event_id and member_id is not null
  on conflict (event_id, tee_time, tee_number) do nothing;
  get diagnostics created_count = row_count;

  insert into public.event_scorecard_players (scorecard_id, member_id, display_name, handicap_used, position)
  select c.id, t.member_id, p.full_name,
    greatest(0, least(54, round(coalesce(
      (select s.next_handicap from public.scores s join public.rounds r on r.id=s.round_id
       where s.member_id=t.member_id and s.next_handicap is not null and r.season=2027
       order by r.round_number desc limit 1), p.handicap, 0
    ))::integer)), t.position
  from public.tee_times t
  join public.event_scorecards c on c.event_id=t.event_id and c.tee_time=t.tee_time and c.tee_number=t.tee_number
  join public.profiles p on p.id=t.member_id
  where t.event_id=target_event_id and t.member_id is not null
  on conflict (scorecard_id, member_id) do nothing;
  return created_count;
end;
$$;
revoke all on function public.prepare_event_scorecards(uuid) from public, anon;
grant execute on function public.prepare_event_scorecards(uuid) to authenticated;

-- First group member to start becomes the official scorer.
create or replace function public.claim_scorecard(target_scorecard_id uuid)
returns public.event_scorecards language plpgsql security definer set search_path = public as $$
declare result public.event_scorecards;
begin
  if not public.is_scorecard_group_member(target_scorecard_id) then raise exception 'You are not in this tee group'; end if;
  update public.event_scorecards set scorer_id=auth.uid(), status='in_progress', updated_at=now()
  where id=target_scorecard_id and status in ('ready','in_progress') and (scorer_id is null or scorer_id=auth.uid())
  returning * into result;
  if result.id is null then raise exception 'Another group member is already scoring this card'; end if;
  return result;
end;
$$;
revoke all on function public.claim_scorecard(uuid) from public, anon;
grant execute on function public.claim_scorecard(uuid) to authenticated;

-- Idempotent bulk sync from the phone's offline queue.
create or replace function public.sync_scorecard(target_scorecard_id uuid, score_changes jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare sync_time timestamptz := now();
begin
  if not exists (select 1 from public.event_scorecards where id=target_scorecard_id and scorer_id=auth.uid() and status='in_progress')
     and not public.is_admin() then raise exception 'Only the nominated scorer can update this card'; end if;
  insert into public.event_hole_scores (scorecard_player_id,hole_number,strokes,picked_up,updated_at)
  select (x->>'player_id')::uuid, (x->>'hole')::integer,
    case when coalesce((x->>'picked_up')::boolean,false) then null else (x->>'strokes')::integer end,
    coalesce((x->>'picked_up')::boolean,false), sync_time
  from jsonb_array_elements(score_changes) x
  join public.event_scorecard_players p on p.id=(x->>'player_id')::uuid and p.scorecard_id=target_scorecard_id
  on conflict (scorecard_player_id,hole_number) do update set
    strokes=excluded.strokes,picked_up=excluded.picked_up,updated_at=excluded.updated_at;
  update public.event_scorecards set updated_at=sync_time where id=target_scorecard_id;
  return sync_time;
end;
$$;
revoke all on function public.sync_scorecard(uuid,jsonb) from public, anon;
grant execute on function public.sync_scorecard(uuid,jsonb) to authenticated;

create or replace function public.submit_scorecard(target_scorecard_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.event_scorecards where id=target_scorecard_id and scorer_id=auth.uid() and status='in_progress')
     and not public.is_admin() then raise exception 'Only the nominated scorer can submit this card'; end if;
  if exists (
    select 1 from public.event_scorecard_players p cross join generate_series(1,18) h
    left join public.event_hole_scores s on s.scorecard_player_id=p.id and s.hole_number=h
    where p.scorecard_id=target_scorecard_id and s.scorecard_player_id is null
  ) then raise exception 'Every player needs a score or pick-up on all 18 holes'; end if;
  update public.event_scorecards set status='submitted',submitted_at=now(),updated_at=now() where id=target_scorecard_id;
end;
$$;
revoke all on function public.submit_scorecard(uuid) from public, anon;
grant execute on function public.submit_scorecard(uuid) to authenticated;

-- Stableford: 2 points for nett par, one point either side, minimum zero.
create or replace function public.stableford_points(gross integer, picked_up boolean, par_value integer, handicap integer, stroke_index integer)
returns integer language sql immutable set search_path = public as $$
  select case when picked_up or gross is null then 0 else greatest(0,
    2 + par_value - (gross - greatest(0, ((handicap - stroke_index) / 18) + 1))
  ) end;
$$;

-- Complete the round atomically: publish totals, league positions and next handicaps.
create or replace function public.complete_event_round(target_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_round public.rounds; round_average integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if exists (select 1 from public.event_scorecards where event_id=target_event_id and status <> 'submitted')
     or not exists (select 1 from public.event_scorecards where event_id=target_event_id) then
    raise exception 'All group scorecards must be submitted first';
  end if;
  select * into target_round from public.rounds where event_id=target_event_id;
  if target_round.id is null then raise exception 'This event has no linked league round'; end if;

  with totals as (
    select p.member_id,p.handicap_used,
      sum(public.stableford_points(s.strokes,s.picked_up,h.par,p.handicap_used,h.stroke_index))::integer points
    from public.event_scorecard_players p join public.event_scorecards c on c.id=p.scorecard_id
    join public.event_hole_scores s on s.scorecard_player_id=p.id
    join public.event_holes h on h.event_id=c.event_id and h.hole_number=s.hole_number
    where c.event_id=target_event_id group by p.member_id,p.handicap_used
  )
  insert into public.scores(round_id,member_id,handicap_used,points,dnp,updated_at)
  select target_round.id,member_id,handicap_used,points,false,now() from totals
  on conflict (round_id,member_id) do update set handicap_used=excluded.handicap_used,points=excluded.points,dnp=false,updated_at=now();

  if (select count(*) from public.scores where round_id=target_round.id and not dnp) < 4 then
    raise exception 'At least four completed player scores are required';
  end if;
  with ordered as (
    select points,row_number() over(order by points) row_no,count(*) over() player_count
    from public.scores where round_id=target_round.id and not dnp
  )
  select round(avg(points))::integer into round_average from ordered
  where player_count <= 4 or row_no not in (1,player_count);

  update public.scores s set
    adjustment = greatest(-3,least(2,round((case
      when s.points-round_average>=10 then -4 when s.points-round_average>=8 then -3
      when s.points-round_average>=6 then -2 when s.points-round_average>=4 then -1
      when s.points-round_average>=2 then -0.5 when s.points-round_average>=-1 then 0
      when s.points-round_average>=-3 then 0.5 when s.points-round_average>=-5 then 1
      when s.points-round_average>=-7 then 2 when s.points-round_average>=-9 then 3 else 4 end)
      * (case when s.handicap_used<=9 then .5 when s.handicap_used<=18 then .75 when s.handicap_used<=28 then 1 else 1.25 end))::integer)),
    next_handicap = greatest(0,s.handicap_used + greatest(-3,least(2,round((case
      when s.points-round_average>=10 then -4 when s.points-round_average>=8 then -3
      when s.points-round_average>=6 then -2 when s.points-round_average>=4 then -1
      when s.points-round_average>=2 then -0.5 when s.points-round_average>=-1 then 0
      when s.points-round_average>=-3 then 0.5 when s.points-round_average>=-5 then 1
      when s.points-round_average>=-7 then 2 when s.points-round_average>=-9 then 3 else 4 end)
      * (case when s.handicap_used<=9 then .5 when s.handicap_used<=18 then .75 when s.handicap_used<=28 then 1 else 1.25 end))::integer)))
  where s.round_id=target_round.id;

  with ranked as (
    select id,row_number() over(order by points desc,handicap_used asc,member_id) place
    from public.scores where round_id=target_round.id and not dnp
  ) update public.scores s set winner=(r.place=1),runner_up=(r.place=2),third_place=(r.place=3)
    from ranked r where s.id=r.id;
  update public.profiles p set handicap=s.next_handicap,updated_at=now()
    from public.scores s where s.round_id=target_round.id and s.member_id=p.id;
  update public.rounds set locked=true,played_on=(select event_date from public.events where id=target_event_id) where id=target_round.id;
  update public.event_scorecards set status='locked',updated_at=now() where event_id=target_event_id;
  update public.events set status='completed',updated_at=now() where id=target_event_id;
end;
$$;
revoke all on function public.complete_event_round(uuid) from public, anon;
grant execute on function public.complete_event_round(uuid) to authenticated;

grant select on public.event_holes,public.event_scorecards,public.event_scorecard_players,public.event_hole_scores to authenticated;
grant insert,update,delete on public.event_holes,public.event_scorecards,public.event_scorecard_players,public.event_hole_scores to authenticated;
create index if not exists event_scorecard_players_member_id_idx on public.event_scorecard_players(member_id);
create index if not exists event_scorecards_scorer_id_idx on public.event_scorecards(scorer_id);
notify pgrst, 'reload schema';
