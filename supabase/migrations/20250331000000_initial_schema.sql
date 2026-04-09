-- Profiles: one row per auth user (filled by trigger on signup)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new; -- NEW row (after insert trigger)
end;
$$;

-- If this fails on your Postgres version, try: execute function public.handle_new_user();
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Flashcards per user
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create index flashcards_user_id_created_at_idx
  on public.flashcards (user_id, created_at);

alter table public.flashcards enable row level security;

create policy "flashcards_select_own"
  on public.flashcards for select
  using (user_id = auth.uid());

create policy "flashcards_insert_own"
  on public.flashcards for insert
  with check (user_id = auth.uid());

create policy "flashcards_update_own"
  on public.flashcards for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "flashcards_delete_own"
  on public.flashcards for delete
  using (user_id = auth.uid());
