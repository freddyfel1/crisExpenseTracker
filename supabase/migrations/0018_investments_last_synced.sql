-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.
--
-- Same problem as 0017, but for the Investments page's "Sync from bank" button: it had
-- no freshness indicator at all, so a healthy sync that finds nothing new to import looks
-- identical to a broken one. Kept as its own column (not last_synced_at from 0017) since
-- plaid-sync-transactions and plaid-sync-investments run independently — a transactions
-- sync shouldn't make the investments sync look more recent than it is, or vice versa.
alter table public.plaid_items
  add column if not exists investments_last_synced_at timestamptz;

-- One button syncs every connected investment account at once, so the UI only needs the
-- most recent attempt across all of the caller's items, not a per-item breakdown.
create or replace function public.get_investments_last_synced()
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$
  select max(investments_last_synced_at)
  from public.plaid_items
  where user_id = auth.uid()
$$;

revoke all on function public.get_investments_last_synced() from public, anon;
grant execute on function public.get_investments_last_synced() to authenticated;
