-- Barford Golf Society 2027 playing-list add-on.
-- Run only in the separate 2027 project: xspzmthygrajzktydvvj.
-- This returns member names only. It does not expose email addresses or phone numbers.

create or replace function public.get_event_playing_list(target_event_id uuid)
returns table (
  member_id uuid,
  full_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in to view the playing list.';
  end if;

  if not public.is_admin()
    and not exists (
      select 1
      from public.rsvps
      where event_id = target_event_id
        and member_id = auth.uid()
        and status = 'playing'
    ) then
    raise exception 'Only confirmed players can view this event playing list.';
  end if;

  return query
    select profiles.id, profiles.full_name
    from public.rsvps
    join public.profiles on profiles.id = rsvps.member_id
    where rsvps.event_id = target_event_id
      and rsvps.status = 'playing'
    order by lower(profiles.full_name);
end;
$$;

revoke all on function public.get_event_playing_list(uuid) from public;
grant execute on function public.get_event_playing_list(uuid) to authenticated;
