-- Allow the current nominated scorer to hand an in-progress card to another
-- member of the same tee group without losing any submitted hole scores.
-- Apply to project xspzmthygrajzktydvvj only.

create or replace function public.handoff_scorecard(
  target_scorecard_id uuid,
  target_new_scorer_id uuid
)
returns public.event_scorecards
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.event_scorecards;
begin
  if auth.uid() is null then
    raise exception 'Sign in before handing over a scorecard';
  end if;
  if target_new_scorer_id is null or target_new_scorer_id = auth.uid() then
    raise exception 'Choose another player from your group';
  end if;
  if not exists (
    select 1 from public.event_scorecards
    where id = target_scorecard_id
      and scorer_id = auth.uid()
      and status = 'in_progress'
  ) then
    raise exception 'Only the current scorer can hand over this card';
  end if;
  if not exists (
    select 1 from public.event_scorecard_players
    where scorecard_id = target_scorecard_id
      and member_id = target_new_scorer_id
  ) then
    raise exception 'The new scorer must be a player in this tee group';
  end if;

  update public.event_scorecards
  set scorer_id = target_new_scorer_id, updated_at = now()
  where id = target_scorecard_id
    and scorer_id = auth.uid()
    and status = 'in_progress'
  returning * into result;

  if result.id is null then
    raise exception 'The scorecard changed before handover. Reload and try again';
  end if;
  return result;
end;
$$;

revoke all on function public.handoff_scorecard(uuid, uuid) from public, anon;
grant execute on function public.handoff_scorecard(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
