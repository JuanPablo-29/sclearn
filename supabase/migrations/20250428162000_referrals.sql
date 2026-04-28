alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id);

create unique index if not exists profiles_referral_code_unique_idx
  on public.profiles (referral_code)
  where referral_code is not null;

create index if not exists profiles_referral_code_idx
  on public.profiles (referral_code);

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'converted', 'paid')),
  created_at timestamptz not null default now(),
  converted_at timestamptz null,
  paid_at timestamptz null
);

create unique index if not exists referrals_unique_user
  on public.referrals (referred_user_id);

create index if not exists referrals_referrer_status_idx
  on public.referrals (referrer_id, status);

alter table public.referrals enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own"
on public.referrals for select
using (auth.uid() = referrer_id);

drop policy if exists "referrals_no_insert" on public.referrals;
create policy "referrals_no_insert"
on public.referrals for insert
with check (false);

drop policy if exists "referrals_no_update" on public.referrals;
create policy "referrals_no_update"
on public.referrals for update
using (false);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from auth.users u
    where u.id = auth.uid()
      and (
        u.email ilike '%@yourdomain.com'
        or u.email = 'you@example.com'
      )
  );
$$;

create or replace function public.admin_set_referral_code(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_code is null or length(trim(p_code)) < 3 then
    raise exception 'invalid code';
  end if;

  update public.profiles
  set referral_code = lower(trim(p_code))
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_set_referral_code(uuid, text) to authenticated;

create or replace function public.admin_list_referrers()
returns table (
  referrer_id uuid,
  email text,
  referral_code text,
  conversions int,
  pending int,
  paid int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id as referrer_id,
    p.email,
    p.referral_code,
    coalesce(sum(case when r.status = 'converted' then 1 else 0 end), 0)::int as conversions,
    coalesce(sum(case when r.status = 'pending' then 1 else 0 end), 0)::int as pending,
    coalesce(sum(case when r.status = 'paid' then 1 else 0 end), 0)::int as paid
  from public.profiles p
  left join public.referrals r on r.referrer_id = p.id
  where p.referral_code is not null
  group by p.id, p.email, p.referral_code
  order by conversions desc nulls last;
end;
$$;

grant execute on function public.admin_list_referrers() to authenticated;

create or replace function public.admin_list_referrals(p_referrer uuid default null)
returns table (
  id uuid,
  referrer_id uuid,
  referred_user_id uuid,
  status text,
  created_at timestamptz,
  converted_at timestamptz,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    r.id,
    r.referrer_id,
    r.referred_user_id,
    r.status,
    r.created_at,
    r.converted_at,
    r.paid_at
  from public.referrals r
  where (p_referrer is null or r.referrer_id = p_referrer)
  order by r.created_at desc;
end;
$$;

grant execute on function public.admin_list_referrals(uuid) to authenticated;

create or replace function public.admin_mark_paid(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.referrals
  set status = 'paid',
      paid_at = now()
  where id = any(p_ids)
    and status = 'converted';
end;
$$;

grant execute on function public.admin_mark_paid(uuid[]) to authenticated;

create or replace function public.link_referrer_by_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  code text;
  referrer uuid;
  already_referred uuid;
begin
  if uid is null then
    return;
  end if;

  code := lower(trim(coalesce(p_code, '')));
  if code = '' then
    return;
  end if;

  select referred_by into already_referred
  from public.profiles
  where id = uid;

  if already_referred is not null then
    return;
  end if;

  select id into referrer
  from public.profiles
  where referral_code = code
  limit 1;

  if referrer is null or referrer = uid then
    return;
  end if;

  update public.profiles
  set referred_by = referrer
  where id = uid
    and referred_by is null;

  insert into public.referrals (referrer_id, referred_user_id, status)
  values (referrer, uid, 'pending')
  on conflict (referred_user_id) do nothing;
end;
$$;

grant execute on function public.link_referrer_by_code(text) to authenticated;
