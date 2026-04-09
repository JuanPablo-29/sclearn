-- Per-user AI generation usage (UTC calendar day).
-- `pending` supports race-safe quota: a row is reserved before OpenAI, then finalized or removed.

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  pending boolean not null default false
);

alter table public.usage_logs enable row level security;

create policy "Users can insert their own usage"
  on public.usage_logs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own usage"
  on public.usage_logs
  for select
  using (auth.uid() = user_id);

create policy "Users can update their own usage"
  on public.usage_logs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own pending usage"
  on public.usage_logs
  for delete
  using (auth.uid() = user_id and pending = true);

create index if not exists usage_logs_user_day
  on public.usage_logs (user_id, created_at);

-- Serialize quota checks per user per UTC day (prevents concurrent over-use).
create or replace function public.begin_flashcard_generation(p_daily_limit int default 10)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamptz;
  day_end timestamptz;
  n int;
  new_id uuid;
begin
  if auth.uid() is null then
    return json_build_object('allowed', false, 'log_id', null);
  end if;

  day_start := ((now() at time zone 'utc')::date)::timestamptz at time zone 'utc';
  day_end := day_start + interval '1 day';

  perform pg_advisory_xact_lock(
    hashtext(auth.uid()::text),
    hashtext(((now() at time zone 'utc')::date)::text)
  );

  select count(*)::int into n
  from public.usage_logs
  where user_id = auth.uid()
    and created_at >= day_start
    and created_at < day_end;

  if n >= p_daily_limit then
    return json_build_object('allowed', false, 'log_id', null);
  end if;

  insert into public.usage_logs (user_id, pending)
  values (auth.uid(), true)
  returning id into new_id;

  return json_build_object('allowed', true, 'log_id', new_id);
end;
$$;

create or replace function public.finalize_flashcard_generation(p_log_id uuid, p_success boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  if p_success then
    update public.usage_logs
    set pending = false
    where id = p_log_id
      and user_id = auth.uid()
      and pending = true;
  else
    delete from public.usage_logs
    where id = p_log_id
      and user_id = auth.uid()
      and pending = true;
  end if;
end;
$$;

revoke all on function public.begin_flashcard_generation(int) from public;
grant execute on function public.begin_flashcard_generation(int) to authenticated;

revoke all on function public.finalize_flashcard_generation(uuid, boolean) from public;
grant execute on function public.finalize_flashcard_generation(uuid, boolean) to authenticated;
