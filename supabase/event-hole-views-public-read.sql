-- Public GPS viewers may read only tee, green and hazard coordinates.
-- Administrators retain the existing write policy.
grant select on public.event_hole_views to anon, authenticated;
create policy "Public can view mapped hole locations"
on public.event_hole_views for select
to anon, authenticated
using (true);
