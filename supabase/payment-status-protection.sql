-- A member may manage their RSVP, but only an administrator or trusted backend
-- may confirm that money has been received.
create or replace function public.protect_rsvp_payment_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.payment_status := 'payment_due';
    elsif new.payment_status is distinct from old.payment_status then
      raise exception using
        errcode = '42501',
        message = 'Payment status can only be changed by an administrator.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_rsvp_payment_status_trigger on public.rsvps;
create trigger protect_rsvp_payment_status_trigger
before insert or update of payment_status on public.rsvps
for each row execute function public.protect_rsvp_payment_status();

revoke all on function public.protect_rsvp_payment_status() from public, anon, authenticated;
