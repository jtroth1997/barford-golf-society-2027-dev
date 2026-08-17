alter table public.profiles add column if not exists playing_category text;
alter table public.profiles drop constraint if exists profiles_playing_category_check;
alter table public.profiles add constraint profiles_playing_category_check check (playing_category in ('men','women'));

alter table public.events add column if not exists uk_golf_club_id text;
alter table public.events add column if not exists uk_golf_course_id text;
alter table public.events add column if not exists selected_course_name text;
alter table public.events add column if not exists longest_drive_winner_id uuid references public.profiles(id) on delete set null;
alter table public.events add column if not exists nearest_pin_winner_id uuid references public.profiles(id) on delete set null;

alter table public.event_holes add column if not exists red_par integer check (red_par between 3 and 6);
alter table public.event_holes add column if not exists red_yards integer check (red_yards between 40 and 800);
alter table public.event_holes add column if not exists red_stroke_index integer check (red_stroke_index between 1 and 18);
alter table public.event_holes add column if not exists yellow_tee_name text not null default 'Yellow';
alter table public.event_holes add column if not exists red_tee_name text not null default 'Red';

alter table public.event_scorecard_players add column if not exists playing_category text;
alter table public.event_scorecard_players add column if not exists tee_name text;
alter table public.event_scorecard_players drop constraint if exists event_scorecard_players_playing_category_check;
alter table public.event_scorecard_players add constraint event_scorecard_players_playing_category_check check (playing_category in ('men','women'));

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, playing_category)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Member'),
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    case when new.raw_user_meta_data->>'playing_category' in ('men','women') then new.raw_user_meta_data->>'playing_category' else null end
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

create or replace function public.prepare_event_scorecards(target_event_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare created_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if (select count(*) from public.event_holes where event_id = target_event_id and red_yards is not null) <> 18 then
    raise exception 'Load the yellow and red course scorecards first';
  end if;
  if not exists (select 1 from public.tee_times where event_id = target_event_id and member_id is not null) then
    raise exception 'Publish tee times before preparing scorecards';
  end if;
  if exists (
    select 1 from public.tee_times t join public.profiles p on p.id=t.member_id
    where t.event_id=target_event_id and t.member_id is not null and p.playing_category is null
  ) then raise exception 'Every player must select Men''s or Women''s playing category in My Account'; end if;

  insert into public.event_scorecards (event_id, tee_time, tee_number)
  select distinct event_id, tee_time, tee_number from public.tee_times
  where event_id = target_event_id and member_id is not null
  on conflict (event_id, tee_time, tee_number) do nothing;
  get diagnostics created_count = row_count;

  insert into public.event_scorecard_players (scorecard_id, member_id, display_name, handicap_used, position, playing_category, tee_name)
  select c.id, t.member_id, p.full_name,
    greatest(0, least(54, round(coalesce(
      (select s.next_handicap from public.scores s join public.rounds r on r.id=s.round_id
       where s.member_id=t.member_id and s.next_handicap is not null and r.season=2027
       order by r.round_number desc limit 1), p.handicap, 0
    ))::integer)), t.position, p.playing_category,
    case when p.playing_category='women' then coalesce(h.red_tee_name,'Red') else coalesce(h.yellow_tee_name,'Yellow') end
  from public.tee_times t
  join public.event_scorecards c on c.event_id=t.event_id and c.tee_time=t.tee_time and c.tee_number=t.tee_number
  join public.profiles p on p.id=t.member_id
  left join public.event_holes h on h.event_id=t.event_id and h.hole_number=1
  where t.event_id=target_event_id and t.member_id is not null
  on conflict (scorecard_id, member_id) do update set
    display_name=excluded.display_name,handicap_used=excluded.handicap_used,position=excluded.position,
    playing_category=excluded.playing_category,tee_name=excluded.tee_name;
  return created_count;
end;
$$;
revoke all on function public.prepare_event_scorecards(uuid) from public, anon;
grant execute on function public.prepare_event_scorecards(uuid) to authenticated;

create or replace function public.reopen_event_scorecard(target_scorecard_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if exists (
    select 1 from public.event_scorecards c join public.events e on e.id=c.event_id
    where c.id=target_scorecard_id and e.status='completed'
  ) then raise exception 'A completed round cannot be reopened'; end if;
  update public.event_scorecards set status='in_progress',submitted_at=null,updated_at=now()
  where id=target_scorecard_id and status='submitted';
  if not found then raise exception 'Only a submitted scorecard can be reopened'; end if;
end;
$$;
revoke all on function public.reopen_event_scorecard(uuid) from public, anon;
grant execute on function public.reopen_event_scorecard(uuid) to authenticated;

create or replace function public.complete_event_round(target_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_round public.rounds; round_average integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if exists (select 1 from public.event_scorecards where event_id=target_event_id and status <> 'submitted')
     or not exists (select 1 from public.event_scorecards where event_id=target_event_id) then raise exception 'All group scorecards must be submitted first'; end if;
  select * into target_round from public.rounds where event_id=target_event_id;
  if target_round.id is null then raise exception 'This event has no linked league round'; end if;

  with totals as (
    select p.member_id,p.handicap_used,
      sum(public.stableford_points(s.strokes,s.picked_up,
        case when p.playing_category='women' then coalesce(h.red_par,h.par) else h.par end,
        p.handicap_used,
        case when p.playing_category='women' then coalesce(h.red_stroke_index,h.stroke_index) else h.stroke_index end
      ))::integer points
    from public.event_scorecard_players p join public.event_scorecards c on c.id=p.scorecard_id
    join public.event_hole_scores s on s.scorecard_player_id=p.id
    join public.event_holes h on h.event_id=c.event_id and h.hole_number=s.hole_number
    where c.event_id=target_event_id group by p.member_id,p.handicap_used
  )
  insert into public.scores(round_id,member_id,handicap_used,points,dnp,updated_at)
  select target_round.id,member_id,handicap_used,points,false,now() from totals
  on conflict (round_id,member_id) do update set handicap_used=excluded.handicap_used,points=excluded.points,dnp=false,updated_at=now();

  if (select count(*) from public.scores where round_id=target_round.id and not dnp) < 2 then raise exception 'At least two completed player scores are required'; end if;
  with ordered as (
    select points,row_number() over(order by points) row_no,count(*) over() player_count
    from public.scores where round_id=target_round.id and not dnp
  ) select round(avg(points))::integer into round_average from ordered where player_count <= 4 or row_no not in (1,player_count);

  update public.scores s set
    adjustment = greatest(-3,least(2,round((case
      when s.points-round_average>=10 then -4 when s.points-round_average>=8 then -3 when s.points-round_average>=6 then -2
      when s.points-round_average>=4 then -1 when s.points-round_average>=2 then -0.5 when s.points-round_average>=-1 then 0
      when s.points-round_average>=-3 then 0.5 when s.points-round_average>=-5 then 1 when s.points-round_average>=-7 then 2
      when s.points-round_average>=-9 then 3 else 4 end) *
      (case when s.handicap_used<=9 then .5 when s.handicap_used<=18 then .75 when s.handicap_used<=28 then 1 else 1.25 end))::integer)),
    next_handicap = greatest(0,s.handicap_used + greatest(-3,least(2,round((case
      when s.points-round_average>=10 then -4 when s.points-round_average>=8 then -3 when s.points-round_average>=6 then -2
      when s.points-round_average>=4 then -1 when s.points-round_average>=2 then -0.5 when s.points-round_average>=-1 then 0
      when s.points-round_average>=-3 then 0.5 when s.points-round_average>=-5 then 1 when s.points-round_average>=-7 then 2
      when s.points-round_average>=-9 then 3 else 4 end) *
      (case when s.handicap_used<=9 then .5 when s.handicap_used<=18 then .75 when s.handicap_used<=28 then 1 else 1.25 end))::integer)))
  where s.round_id=target_round.id;
  with hole_points as (
    select p.member_id,h.hole_number,
      public.stableford_points(s.strokes,s.picked_up,
        case when p.playing_category='women' then coalesce(h.red_par,h.par) else h.par end,
        p.handicap_used,
        case when p.playing_category='women' then coalesce(h.red_stroke_index,h.stroke_index) else h.stroke_index end
      ) points
    from public.event_scorecard_players p
    join public.event_scorecards c on c.id=p.scorecard_id
    join public.event_hole_scores s on s.scorecard_player_id=p.id
    join public.event_holes h on h.event_id=c.event_id and h.hole_number=s.hole_number
    where c.event_id=target_event_id
  ), countback as (
    select member_id,sum(points) total,
      sum(points) filter(where hole_number between 10 and 18) back_nine,
      sum(points) filter(where hole_number between 13 and 18) last_six,
      sum(points) filter(where hole_number between 16 and 18) last_three,
      sum(points) filter(where hole_number=18) last_hole
    from hole_points group by member_id
  ), ranked as (
    select s.id,row_number() over(order by cb.total desc,cb.back_nine desc,cb.last_six desc,cb.last_three desc,cb.last_hole desc,s.handicap_used asc,s.member_id) place
    from public.scores s join countback cb on cb.member_id=s.member_id
    where s.round_id=target_round.id and not s.dnp
  )
  update public.scores s set winner=(r.place=1),runner_up=(r.place=2),third_place=(r.place=3) from ranked r where s.id=r.id;
  update public.scores s set
    longest_drive=(s.member_id=(select longest_drive_winner_id from public.events where id=target_event_id)),
    nearest_pin=(s.member_id=(select nearest_pin_winner_id from public.events where id=target_event_id))
  where s.round_id=target_round.id;
  update public.profiles p set handicap=s.next_handicap,updated_at=now() from public.scores s where s.round_id=target_round.id and s.member_id=p.id;
  update public.rounds set locked=true,played_on=(select event_date from public.events where id=target_event_id) where id=target_round.id;
  update public.event_scorecards set status='locked',updated_at=now() where event_id=target_event_id;
  update public.events set status='completed',updated_at=now() where id=target_event_id;
end;
$$;
revoke all on function public.complete_event_round(uuid) from public, anon;
grant execute on function public.complete_event_round(uuid) to authenticated;
notify pgrst, 'reload schema';
