-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.
--
-- Crypto tickers aren't globally unique the way stock tickers effectively are — two
-- completely unrelated coins/tokens, even on different networks, can share the same symbol
-- (confirmed case: a user's "ETN" holding is a small DEX-only token, not the much bigger,
-- unrelated coin that Finnhub/CoinGecko resolve that ticker to). A manual override here always
-- wins over the shared investment_prices cache for that symbol, and "Price now" leaves it
-- alone rather than silently overwriting it with the wrong coin's price again.
--
-- Scoped by user, not by account: the same symbol should mean the same thing everywhere a
-- user sees it, so one override applies wherever that ticker shows up across their accounts.
create table if not exists public.investment_price_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  price numeric(24, 10) not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.investment_price_overrides enable row level security;

create policy "investment price overrides are owner-readable" on public.investment_price_overrides
  for select using (auth.uid() = user_id);
create policy "investment price overrides are owner-writable" on public.investment_price_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
