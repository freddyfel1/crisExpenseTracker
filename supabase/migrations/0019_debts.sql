-- Debts: loans and credit tracked toward net worth (mortgage, personal loan, credit
-- card, or an informal loan to/from a friend). Like investments, the running balance
-- isn't stored — it's derived client-side from the logged payment history against the
-- original principal, splitting each payment into interest/principal the same way a
-- bank statement does.

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  debt_type text not null default 'other'
    check (debt_type in ('mortgage', 'personal_loan', 'credit_card', 'friend_loan', 'other')),
  institution text,
  principal numeric(12, 2) not null default 0,
  interest_rate numeric(6, 3) not null default 0,
  term_months integer not null default 0,
  monthly_payment numeric(10, 2) not null default 0,
  start_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.debts enable row level security;

create policy "debts are owner-readable" on public.debts
  for select using (auth.uid() = user_id);
create policy "debts are owner-writable" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists debts_user_idx on public.debts (user_id);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount numeric(10, 2) not null default 0,
  occurred_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.debt_payments enable row level security;

create policy "debt payments are owner-readable" on public.debt_payments
  for select using (auth.uid() = user_id);
create policy "debt payments are owner-writable" on public.debt_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists debt_payments_user_idx on public.debt_payments (user_id);
create index if not exists debt_payments_debt_idx on public.debt_payments (debt_id, occurred_on desc);
