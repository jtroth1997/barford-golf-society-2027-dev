-- Explicit scorecard assignment workflow.
-- Apply to project xspzmthygrajzktydvvj only.
-- Prepared cards stay unassigned/ready until an administrator nominates a scorer.

create or replace function public.assign_scorecard_scorer(
  target_scorecard_id uuid,
  target_scorer_id uuid
)
returns public.event_scorecards
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.event_scorecards;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if target_scorer_id is null then
    raise exception 'Choose a scorer from this tee group';
  end if;
  if not exists (
    select 1 from public.event_scorecard_players
    where scorecard_id = target_scorecard_id
      and member_id = target_scorer_id
  ) then
    raise exception 'The scorer must be a player in this tee group';
  end if;

  update public.event_scorecards
  set scorer_id = target_scorer_id,
      updated_at = now()
  where id = target_scorecard_id
    and status = 'ready'
  returning * into result;

  if result.id is null then
    raise exception 'Only a prepared scorecard can be assigned before scoring starts';
  end if;
  return result;
end;
$$;

revoke all on function public.assign_scorecard_scorer(uuid, uuid) from public, anon;
grant execute on function public.assign_scorecard_scorer(uuid, uuid) to authenticated;

-- Opening a prepared card no longer chooses the scorer. Only the member already
-- nominated by an administrator may start it and move ready -> in_progress.
create or replace function public.claim_scorecard(target_scorecard_id uuid)
returns public.event_scorecards
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.event_scorecards;
begin
  if not public.is_scorecard_group_member(target_scorecard_id) then
    raise exception 'You are not in this tee group';
  end if;

  update public.event_scorecards
  set status = 'in_progress', updated_at = now()
  where id = target_scorecard_id
    and scorer_id = auth.uid()
    and status in ('ready','in_progress')
  returning * into result;

  if result.id is null then
    if exists (select 1 from public.event_scorecards where id=target_scorecard_id and scorer_id is null and status='ready') then
      raise exception 'The administrator has not selected a scorer for this group yet';
    end if;
    raise exception 'You are not the nominated scorer for this group';
  end if;
  return result;
end;
$$;

revoke all on function public.claim_scorecard(uuid) from public, anon;
grant execute on function public.claim_scorecard(uuid) to authenticated;
notify pgrst, 'reload schema';
