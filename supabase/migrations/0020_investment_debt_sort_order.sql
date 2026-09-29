-- Drag-to-reorder for investment/crypto account cards and debt cards, mirroring how
-- budget_sections already supports manual ordering.

alter table public.investment_accounts add column if not exists sort_order integer not null default 0;
alter table public.debts add column if not exists sort_order integer not null default 0;

-- Backfill existing rows with a stable order (alphabetical by name, per user) so nothing
-- jumps around the first time this ships — sort_order was 0 for every row until now.
with ranked as (
  select id, row_number() over (partition by user_id order by name) - 1 as rn
  from public.investment_accounts
)
update public.investment_accounts ia
set sort_order = ranked.rn
from ranked
where ranked.id = ia.id;

with ranked as (
  select id, row_number() over (partition by user_id order by name) - 1 as rn
  from public.debts
)
update public.debts d
set sort_order = ranked.rn
from ranked
where ranked.id = d.id;
