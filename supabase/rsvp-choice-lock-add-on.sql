-- Barford Golf Society 2027 RSVP lock add-on.
-- Run only in the separate 2027 project: xspzmthygrajzktydvvj.
-- Member RSVP choices lock when saved tee times exist for the event.
-- Administrators retain case-by-case override access.

create or replace function public.get_event_rsvp_lock_status(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tee_times
    where event_id = target_event_id
  );
$$;

revoke all on function public.get_event_rsvp_lock_status(uuid) from public;
grant execute on function public.get_event_rsvp_lock_status(uuid) to authenticated;

create or replace function public.lock_member_rsvp_choices_after_tee_times()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
      select 1 from public.tee_times
      where event_id = old.event_id
    )
    and not public.is_admin()
    and coalesce(auth.role(), '') <> 'service_role'
    and (
      new.status is distinct from old.status
      or new.buggy_requested is distinct from old.buggy_requested
      or new.preferred_tee_time is distinct from old.preferred_tee_time
    ) then
    raise exception 'RSVP choices are locked because tee times have been produced. Please contact an administrator.';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_member_rsvp_choices_after_tee_times on public.rsvps;
create trigger lock_member_rsvp_choices_after_tee_times
  before update on public.rsvps
  for each row execute function public.lock_member_rsvp_choices_after_tee_times();
