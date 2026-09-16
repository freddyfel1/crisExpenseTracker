-- Links investment_accounts/investment_transactions to Plaid so an automatic sync can
-- upsert into the same tables the manual-entry Investments page already reads. Mirrors
-- the transactions table's Plaid tagging (migration 0010): a plaid_*_id dedup key plus a
-- 'source' column, with a plain unique index (NULLs never conflict, so manual rows are
-- untouched).

alter table public.investment_accounts
  add column if not exists plaid_item_id uuid references public.plaid_items (id) on delete cascade,
  add column if not exists plaid_account_id text;

create unique index if not exists investment_accounts_user_plaid_id_idx
  on public.investment_accounts (user_id, plaid_account_id);

alter table public.investment_transactions
  add column if not exists source text not null default 'manual',
  add column if not exists plaid_investment_transaction_id text;

create unique index if not exists investment_transactions_user_plaid_id_idx
  on public.investment_transactions (user_id, plaid_investment_transaction_id);

-- Plaid's investment transaction types (buy/sell/cancel/cash/fee/transfer, further split by
-- subtype) don't collapse cleanly into just buy/sell/dividend — a broker fee or an account
-- transfer is neither. 'other' catches those without inflating the dividend total the
-- holdings math derives from this column (see holdingsForAccount in both apps' selectors).
alter table public.investment_transactions drop constraint investment_transactions_transaction_type_check;
alter table public.investment_transactions
  add constraint investment_transactions_transaction_type_check
  check (transaction_type in ('buy', 'sell', 'dividend', 'other'));
