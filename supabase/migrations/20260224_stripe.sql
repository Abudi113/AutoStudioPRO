-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Subscriptions table (one row per user)
create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references auth.users not null unique,
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  plan                    text,              -- 'starter' | 'growth' | 'pro'
  status                  text default 'active',  -- 'active' | 'canceled' | 'past_due'
  images_per_month        int,               -- 400 / 1500 / 3500
  current_period_end      timestamptz,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- 2. Credits ledger (append-only; negative rows = deductions)
create table if not exists public.credits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users not null,
  amount           int not null,             -- positive = grant, negative = usage
  reason           text,                     -- 'subscription_starter' | 'addon_500' | 'image_processed' etc.
  stripe_event_id  text unique,              -- idempotency key from Stripe webhook
  created_at       timestamptz default now()
);

alter table public.credits enable row level security;

create policy "Users read own credits"
  on public.credits for select
  using (auth.uid() = user_id);

-- 3. Convenience view: current balance per user
create or replace view public.user_credit_balance as
  select user_id, coalesce(sum(amount), 0)::int as balance
  from public.credits
  group by user_id;
