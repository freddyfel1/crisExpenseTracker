-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.
--
-- Live market prices for held symbols, refreshed via Finnhub (see the
-- finnhub-refresh-prices edge function) and shared across every user — a stock's price
-- isn't private data, so caching it once here avoids burning a separate Finnhub call per
-- user for the same symbol. Only the edge function (service role) writes to this table;
-- everyone else just reads the latest cached price.

create table if not exists public.investment_prices (
  symbol text primary key,
  price numeric(14, 4) not null,
  updated_at timestamptz not null default now()
);

alter table public.investment_prices enable row level security;

create policy "investment prices are readable by any signed-in user" on public.investment_prices
  for select using ((select auth.uid()) is not null);
