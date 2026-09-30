-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.
--
-- Same fix as 0021 (investment_prices.price), but for the user-entered transaction price:
-- numeric(14, 4) silently rounded a smaller-cap crypto's real buy price (e.g. Electroneum
-- around $0.0000161/unit) down to 0.0000 on save, regardless of what was actually typed in —
-- the input could be fixed client-side and it would still be lost here. Widened to match.
alter table public.investment_transactions alter column price_per_unit type numeric(24, 10);
