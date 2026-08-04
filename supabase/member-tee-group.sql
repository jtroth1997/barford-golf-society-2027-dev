create or replace function public.get_my_event_tee_group(target_event_id uuid)
returns table (
  member_id uuid,
  full_name text,
  photo_url text,
  guest_name text,
  tee_time time,
  tee_number integer,
  slot_position integer,
  is_you boolean,
  buggy_requested boolean
)
language sql
security definer
set search_path = public
as $$
  select
    group_slot.member_id,
    coalesce(p.full_name, group_slot.guest_name, 'Guest player')::text,
    p.photo_url,
    group_slot.guest_name,
    group_slot.tee_time,
    group_slot.tee_number,
    group_slot.position as slot_position,
    (group_slot.member_id = auth.uid()),
    coalesce(r.buggy_requested, false)
  from public.tee_times mine
  join public.tee_times group_slot
    on group_slot.event_id = mine.event_id
    and group_slot.tee_time = mine.tee_time
    and group_slot.tee_number = mine.tee_number
  left join public.profiles p on p.id = group_slot.member_id
  left join public.rsvps r
    on r.event_id = group_slot.event_id
    and r.member_id = group_slot.member_id
  where mine.event_id = target_event_id
    and mine.member_id = auth.uid()
  order by group_slot.position;
$$;

revoke all on function public.get_my_event_tee_group(uuid) from public;
grant execute on function public.get_my_event_tee_group(uuid) to authenticated;

notify pgrst, 'reload schema';
