-- The plaid_connections view (0010) tripped the "security_definer_view" advisor: Postgres
-- creates non-invoker views by default, which is exactly what's needed here to read through
-- plaid_items' RLS-deny, but the linter flags that pattern broadly since it's an easy accident
-- elsewhere. A security definer *function* is the endorsed way to do the same thing on
-- purpose: explicit, pinned search_path, and grants scoped to exactly one safe query.
drop view if exists public.plaid_connections;

create or replace function public.get_plaid_connections()
returns table (id uuid, item_id text, institution_name text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select id, item_id, institution_name, created_at
  from public.plaid_items
  where user_id = auth.uid()
$$;

revoke all on function public.get_plaid_connections() from public, anon;
grant execute on function public.get_plaid_connections() to authenticated;
