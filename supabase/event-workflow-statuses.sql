-- Persisted admin workflow states. The events table remains the source of truth;
-- these fields distinguish drafts and published stages without replacing it.
alter table public.events
  add column if not exists tee_times_status text not null default 'not_started'
    check (tee_times_status in ('not_started','draft','published')),
  add column if not exists scorecards_status text not null default 'not_started'
    check (scorecards_status in ('not_started','course_verified','generated','published')),
  add column if not exists results_status text not null default 'not_started'
    check (results_status in ('not_started','collecting','ready_to_review','verified','published'));

update public.events e
set tee_times_status = case when exists (select 1 from public.tee_times t where t.event_id=e.id) then 'published' else 'not_started' end,
    scorecards_status = case
      when exists (select 1 from public.event_scorecards c where c.event_id=e.id) then 'published'
      when (select count(*) from public.event_holes h where h.event_id=e.id)=18 then 'course_verified'
      else 'not_started'
    end,
    results_status = case
      when e.status='completed' then 'published'
      when exists (select 1 from public.event_scorecards c where c.event_id=e.id)
       and not exists (select 1 from public.event_scorecards c where c.event_id=e.id and c.status not in ('submitted','locked')) then 'ready_to_review'
      when exists (select 1 from public.event_scorecards c where c.event_id=e.id) then 'collecting'
      else 'not_started'
    end;

create or replace function public.sync_event_result_workflow()
returns trigger language plpgsql security definer set search_path=public as $$
declare target uuid; total_cards integer; completed_cards integer;
begin
  target := coalesce(new.event_id, old.event_id);
  if (select status from public.events where id=target) = 'completed' then return coalesce(new, old); end if;
  select count(*), count(*) filter (where status in ('submitted','locked'))
    into total_cards, completed_cards from public.event_scorecards where event_id=target;
  update public.events
     set results_status = case when total_cards=0 then 'not_started'
                               when total_cards=completed_cards then 'ready_to_review'
                               else 'collecting' end,
         updated_at=now()
   where id=target;
  return coalesce(new, old);
end $$;

drop trigger if exists event_scorecard_result_workflow on public.event_scorecards;
create trigger event_scorecard_result_workflow
after insert or update of status or delete on public.event_scorecards
for each row execute function public.sync_event_result_workflow();
