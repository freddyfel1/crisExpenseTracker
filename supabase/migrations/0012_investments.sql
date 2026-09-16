-- Investments: manual tracking of ETF/crypto/brokerage holdings that live at
-- a bank or platform but aren't part of the everyday expense ledger. Holdings
-- and cost basis are derived client-side from the transaction log rather than
-- stored, same way category totals are derived from `transactions`.

create table if not exists public.investment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  institution text,
  account_type text not null default 'brokerage'
    check (account_type in ('brokerage', 'crypto', 'retirement', 'other')),
  created_at timestamptz not null default now()
);

alter table public.investment_accounts enable row level security;

create policy "investment accounts are owner-readable" on public.investment_accounts
  for select using (auth.uid() = user_id);
create policy "investment accounts are owner-writable" on public.investment_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists investment_accounts_user_idx on public.investment_accounts (user_id);

create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.investment_accounts (id) on delete cascade,
  symbol text not null,
  asset_type text not null default 'etf'
    check (asset_type in ('etf', 'stock', 'crypto', 'other')),
  transaction_type text not null
    check (transaction_type in ('buy', 'sell', 'dividend')),
  -- crypto trades can be fractional to many decimal places; numeric(18,8)
  -- comfortably covers both share counts and satoshi-level crypto amounts.
  quantity numeric(18, 8) not null default 0,
  price_per_unit numeric(14, 4) not null default 0,
  fees numeric(10, 2) not null default 0,
  occurred_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.investment_transactions enable row level security;

create policy "investment transactions are owner-readable" on public.investment_transactions
  for select using (auth.uid() = user_id);
create policy "investment transactions are owner-writable" on public.investment_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists investment_transactions_user_idx on public.investment_transactions (user_id);
create index if not exists investment_transactions_account_idx on public.investment_transactions (account_id, occurred_on desc);
