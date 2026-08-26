-- crisExpenseTracker initial schema
-- Shared by the web dashboard and the Expo mobile app.
-- Run this once against a fresh Supabase project (SQL Editor, or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, holds account/notification settings
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  currency text not null default 'USD',
  notify_budget_alerts boolean not null default true,
  notify_weekly_summary boolean not null default true,
  notify_receipt_sync boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are self-readable" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles are self-updatable" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles are self-insertable" on public.profiles
  for insert with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- categories: per-user, seeded with defaults on signup, user can add/edit/delete
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text not null default 'CircleDashed',
  color text not null default '#7c8175',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.categories enable row level security;

create policy "categories are owner-readable" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories are owner-writable" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists categories_user_id_idx on public.categories (user_id);

-- ---------------------------------------------------------------------------
-- transactions: the core expense ledger
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  merchant text not null,
  amount numeric(10, 2) not null,
  occurred_on date not null default current_date,
  tax numeric(10, 2),
  tip numeric(10, 2),
  payment_method text,
  notes text,
  tags text[] not null default '{}',
  receipt_image_path text, -- path within the "receipts" storage bucket
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions are owner-readable" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions are owner-writable" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- hot query paths: dashboard/report filters by user + date range + category
create index if not exists transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category_id);

-- ---------------------------------------------------------------------------
-- budgets: one monthly limit per user per category
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  monthly_limit numeric(10, 2) not null default 0,
  primary key (user_id, category_id)
);

alter table public.budgets enable row level security;

create policy "budgets are owner-readable" on public.budgets
  for select using (auth.uid() = user_id);
create policy "budgets are owner-writable" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- seed defaults for every new user: profile row + the 16 starter categories
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));

  insert into public.categories (user_id, name, icon, color) values
    (new.id, 'Food & Dining',     'UtensilsCrossed', '#b4483a'),
    (new.id, 'Groceries',         'ShoppingBasket',  '#2f6f52'),
    (new.id, 'Transportation',    'Bus',             '#3b6e8f'),
    (new.id, 'Fuel',              'Fuel',            '#a15c2f'),
    (new.id, 'Shopping',          'ShoppingBag',     '#8a5fb0'),
    (new.id, 'Bills & Utilities', 'Receipt',         '#5a5f52'),
    (new.id, 'Rent/Housing',      'Home',            '#1e4a37'),
    (new.id, 'Health',            'HeartPulse',      '#c0546b'),
    (new.id, 'Entertainment',     'Clapperboard',    '#b3872f'),
    (new.id, 'Travel',            'Plane',           '#3f7d7a'),
    (new.id, 'Education',         'GraduationCap',   '#4a5a8f'),
    (new.id, 'Subscriptions',     'RefreshCcw',      '#6b6f3f'),
    (new.id, 'Personal Care',     'Sparkles',        '#b0708a'),
    (new.id, 'Gifts & Donations', 'Gift',            '#c46b3f'),
    (new.id, 'Business',          'Briefcase',       '#3f4f6b'),
    (new.id, 'Other',             'CircleDashed',    '#7c8175');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- storage: receipt photos, one folder per user (<user_id>/<filename>)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts are owner-readable"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts are owner-writable"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts are owner-deletable"
  on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
