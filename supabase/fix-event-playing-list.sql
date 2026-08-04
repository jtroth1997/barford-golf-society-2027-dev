-- Fix confirmed player list lookup.
-- Qualifies rsvps.member_id so it is not confused with the function's output column.

create or replace function public.get_event_playing_list(target_event_id uuid)
returns table(member_id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in to view the playing list.';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from public.rsvps r_check
    where r_check.event_id = target_event_id
      and r_check.member_id = auth.uid()
      and r_check.status = 'playing'
  ) then
    raise exception 'Only confirmed players can view this event playing list.';
  end if;

  return query
    select p.id, p.full_name
    from public.rsvps r
    join public.profiles p on p.id = r.member_id
    where r.event_id = target_event_id
      and r.status = 'playing'
    order by lower(p.full_name);
end;
$$;

revoke all on function public.get_event_playing_list(uuid) from public;
grant execute on function public.get_event_playing_list(uuid) to authenticated;

notify pgrst, 'reload schema';
