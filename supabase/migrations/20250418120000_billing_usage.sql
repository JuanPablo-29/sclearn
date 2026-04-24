-- Billing (Stripe) columns on profiles + usage_events for generation/upload quotas.

alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text null,
  add column if not exists stripe_subscription_id text null,
  add column if not exists subscription_status text null,
  add column if not exists current_period_end timestamptz null;

comment on column public.profiles.plan is 'free | pro — webhook keeps in sync with Stripe.';
comment on column public.profiles.subscription_status is 'Stripe subscription.status mirror when subscribed.';

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('generation', 'upload')),
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_type_created_idx
  on public.usage_events (user_id, type, created_at desc);

alter table public.usage_events enable row level security;

create policy "usage_events_select_own"
  on public.usage_events for select
  using (auth.uid() = user_id);

create policy "usage_events_insert_own"
  on public.usage_events for insert
  with check (auth.uid() = user_id);

-- Deck insert limit: 3 free, 10 pro (plan column; webhook maintains pro while subscribed).
create or replace function public.decks_enforce_insert_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  deck_count int;
  max_decks int;
  pl text;
begin
  select coalesce(nullif(trim(plan), ''), 'free') into pl
  from public.profiles
  where id = new.user_id;

  max_decks := case when pl = 'pro' then 10 else 3 end;

  deck_count := (
    select count(*)::int
    from public.decks
    where user_id = new.user_id
  );

  if deck_count >= max_decks then
    raise exception 'Deck limit reached for your plan.';
  end if;

  return new;
end;
$$;

-- Reserve AI generation slot (advisory lock + count usage_events). Free: 3/day UTC. Pro: 200/month UTC.
create or replace function public.reserve_ai_generation_slot()
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
  day_start timestamptz;
  day_end timestamptz;
  y int;
  m int;
begin
  if uid is null then
    return json_build_object('allowed', false, 'code', 'unauthorized');
  end if;

  select coalesce(nullif(trim(plan), ''), 'free') into pl
  from public.profiles
  where id = uid;

  perform pg_advisory_xact_lock(hashtext(uid::text), 9181);

  if pl = 'pro' then
    lim := 200;
    y := extract(year from timezone('utc', now()))::int;
    m := extract(month from timezone('utc', now()))::int;
    select count(*)::int into used
    from public.usage_events
    where user_id = uid
      and type = 'generation'
      and extract(year from timezone('utc', created_at)) = y
      and extract(month from timezone('utc', created_at)) = m;
  else
    lim := 3;
    day_start := ((now() at time zone 'utc')::date)::timestamptz at time zone 'utc';
    day_end := day_start + interval '1 day';
    select count(*)::int into used
    from public.usage_events
    where user_id = uid
      and type = 'generation'
      and created_at >= day_start
      and created_at < day_end;
  end if;

  if used >= lim then
    return json_build_object(
      'allowed', false,
      'code', 'generation_limit',
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

revoke all on function public.reserve_ai_generation_slot() from public;
grant execute on function public.reserve_ai_generation_slot() to authenticated;

-- Record successful generation or upload (called after work succeeds).
create or replace function public.record_usage_event(p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_type is null or p_type not in ('generation', 'upload') then
    raise exception 'invalid usage type';
  end if;

  insert into public.usage_events (user_id, type)
  values (auth.uid(), p_type);
end;
$$;

revoke all on function public.record_usage_event(text) from public;
grant execute on function public.record_usage_event(text) to authenticated;

-- Upload quota: free 1/day UTC, pro 50/month UTC.
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
  day_start timestamptz;
  day_end timestamptz;
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
    lim := 50;
    y := extract(year from timezone('utc', now()))::int;
    m := extract(month from timezone('utc', now()))::int;
    select count(*)::int into used
    from public.usage_events
    where user_id = uid
      and type = 'upload'
      and extract(year from timezone('utc', created_at)) = y
      and extract(month from timezone('utc', created_at)) = m;
  else
    lim := 1;
    day_start := ((now() at time zone 'utc')::date)::timestamptz at time zone 'utc';
    day_end := day_start + interval '1 day';
    select count(*)::int into used
    from public.usage_events
    where user_id = uid
      and type = 'upload'
      and created_at >= day_start
      and created_at < day_end;
  end if;

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
