-- Saved decks (phase 1). Cards stored as JSONB for fast load; sharing fields reserved.

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text null,
  cards jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_public boolean not null default false,
  share_slug text null unique
);

create index decks_user_id_created_at_idx
  on public.decks (user_id, created_at desc);

comment on table public.decks is 'User-owned flashcard decks; share_slug + is_public reserved for public deck links.';
comment on column public.decks.share_slug is 'Future: unique slug for /deck/:share_slug (not exposed in app yet).';

alter table public.decks enable row level security;

create policy "decks_select_own"
  on public.decks for select
  using (auth.uid() = user_id);

create policy "decks_insert_own"
  on public.decks for insert
  with check (auth.uid() = user_id);

create policy "decks_update_own"
  on public.decks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "decks_delete_own"
  on public.decks for delete
  using (auth.uid() = user_id);

-- Free tier: max 3 saved decks per user (insert only).
create or replace function public.decks_enforce_insert_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  deck_count int;
begin
  -- Use := (subquery) so this is not parsed as SQL SELECT INTO <new_table>.
  deck_count := (
    select count(*)::int
    from public.decks
    where user_id = new.user_id
  );
  if deck_count >= 3 then
    raise exception 'You''ve reached the free limit of 3 saved decks.';
  end if;
  return new;
end;
$$;

create trigger decks_enforce_insert_limit_trg
  before insert on public.decks
  for each row execute procedure public.decks_enforce_insert_limit();

create or replace function public.decks_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger decks_touch_updated_at_trg
  before update on public.decks
  for each row execute procedure public.decks_touch_updated_at();
