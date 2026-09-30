-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.
--
-- numeric(14, 4) rounds any sub-cent price (many smaller-cap/meme coins, e.g. SHIB, trade
-- well under $0.0001) down to 0.0000, which then looks identical to "never priced" in the
-- UI. Widened to 10 decimal places, comfortably below what CoinGecko/Finnhub actually
-- return, while still allowing a large integer part for expensive assets.
alter table public.investment_prices alter column price type numeric(24, 10);
