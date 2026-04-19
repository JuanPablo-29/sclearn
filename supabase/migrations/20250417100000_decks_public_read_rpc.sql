-- Public deck reads without exposing user_id: slug-only lookup via SECURITY DEFINER RPC.
--
-- We do NOT add a broad RLS policy like `USING (is_public)` on public.decks: PostgREST would
-- return full rows (including user_id) to anon. Callers use this RPC so only { title, cards } leak.

create or replace function public.get_public_deck_by_slug(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'title', d.title,
    'cards', d.cards
  )
  from public.decks d
  where d.share_slug = p_slug
    and d.is_public = true
    and d.share_slug is not null
  limit 1;
$$;

comment on function public.get_public_deck_by_slug(text) is
  'Returns {title, cards} for a shared deck; no user_id. Callable by anon for /deck/:slug.';

revoke all on function public.get_public_deck_by_slug(text) from public;
grant execute on function public.get_public_deck_by_slug(text) to anon, authenticated;
