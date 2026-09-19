-- Applied directly to the live project via the Supabase MCP; saved here so a fresh
-- project ends up in the same state. See supabase/README.md.
--
-- Links each savings goal to its matching "Transfer to GoalN" category, so a
-- transaction logged under that category shows up on the Goals page under the
-- goal it belongs to, instead of the two staying unrelated by name alone.

alter table public.savings_goals
  add column if not exists linked_category_id uuid references public.categories (id) on delete set null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_goal1_category uuid;
  v_goal2_category uuid;
  v_goal3_category uuid;
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

  insert into public.categories (user_id, name, icon, color)
  values (new.id, 'Transfer to Goal1', 'PiggyBank', '#2d7d6b')
  returning id into v_goal1_category;

  insert into public.categories (user_id, name, icon, color)
  values (new.id, 'Transfer to Goal2', 'PiggyBank', '#1f6f8f')
  returning id into v_goal2_category;

  insert into public.categories (user_id, name, icon, color)
  values (new.id, 'Transfer to Goal3', 'PiggyBank', '#4f6f3f')
  returning id into v_goal3_category;

  insert into public.savings_goals (user_id, name, target_amount, current_amount, sort_order, linked_category_id) values
    (new.id, 'Goal1', 0, 0, 0, v_goal1_category),
    (new.id, 'Goal2', 0, 0, 1, v_goal2_category),
    (new.id, 'Goal3', 0, 0, 2, v_goal3_category);

  return new;
end;
$$;

-- Backfill: link the goals/categories 0014 already created for existing users.
update public.savings_goals sg
set linked_category_id = c.id
from public.categories c
where c.user_id = sg.user_id
  and c.name = 'Transfer to ' || sg.name
  and sg.linked_category_id is null;
