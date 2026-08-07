-- Adds the member-facing reason shown when a society event is cancelled.
alter table public.events add column if not exists cancel_reason text;
