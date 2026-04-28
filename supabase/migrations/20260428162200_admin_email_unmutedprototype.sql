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
        or u.email = 'unmutedprototype@gmail.com'
      )
  );
$$;
