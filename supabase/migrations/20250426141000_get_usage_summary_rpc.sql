create or replace function public.get_usage_summary()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  pl text;
  gen_used int;
  upload_used int;
  decks_used int;
  gen_limit int;
  upload_limit int;
  deck_limit int;
begin
  select p.plan into pl
  from public.profiles p
  where p.id = auth.uid();

  if pl is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::int into gen_used
  from public.usage_events
  where user_id = auth.uid()
    and type = 'generation'
    and date_trunc('day', created_at at time zone 'UTC') =
        date_trunc('day', now() at time zone 'UTC');

  select count(*)::int into upload_used
  from public.usage_events
  where user_id = auth.uid()
    and type = 'upload'
    and date_trunc('month', created_at at time zone 'UTC') =
        date_trunc('month', now() at time zone 'UTC');

  select count(*)::int into decks_used
  from public.decks
  where user_id = auth.uid();

  if pl = 'pro' then
    gen_limit := 9999;
    upload_limit := 100;
    deck_limit := 10;
  else
    gen_limit := 3;
    upload_limit := 3;
    deck_limit := 3;
  end if;

  return json_build_object(
    'plan', pl,
    'generations', json_build_object(
      'used', gen_used,
      'limit', gen_limit,
      'remaining', greatest(gen_limit - gen_used, 0)
    ),
    'uploads', json_build_object(
      'used', upload_used,
      'limit', upload_limit,
      'remaining', greatest(upload_limit - upload_used, 0)
    ),
    'decks', json_build_object(
      'used', decks_used,
      'limit', deck_limit,
      'remaining', greatest(deck_limit - decks_used, 0)
    )
  );
end;
$$;

revoke all on function public.get_usage_summary() from public;
grant execute on function public.get_usage_summary() to authenticated;
