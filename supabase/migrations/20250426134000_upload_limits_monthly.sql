-- Upload quota update: monthly caps by plan.
-- Free: 3/month (UTC), Pro: 100/month (UTC)

create or replace function public.reserve_upload_slot()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pl text;
  lim int;
  used int;
  y int;
  m int;
begin
  if uid is null then
    return json_build_object('allowed', false, 'code', 'unauthorized');
  end if;

  select coalesce(nullif(trim(plan), ''), 'free') into pl
  from public.profiles
  where id = uid;

  perform pg_advisory_xact_lock(hashtext(uid::text), 9182);

  if pl = 'pro' then
    lim := 100;
  else
    lim := 3;
  end if;

  y := extract(year from timezone('utc', now()))::int;
  m := extract(month from timezone('utc', now()))::int;

  select count(*)::int into used
  from public.usage_events
  where user_id = uid
    and type = 'upload'
    and extract(year from timezone('utc', created_at)) = y
    and extract(month from timezone('utc', created_at)) = m;

  if used >= lim then
    return json_build_object(
      'allowed', false,
      'code', 'upload_limit',
      'plan', pl,
      'used', used,
      'limit', lim
    );
  end if;

  return json_build_object(
    'allowed', true,
    'plan', pl,
    'used', used,
    'limit', lim
  );
end;
$$;

revoke all on function public.reserve_upload_slot() from public;
grant execute on function public.reserve_upload_slot() to authenticated;
