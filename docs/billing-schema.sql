-- Dodo Billing + Monthly Credits schema
-- Apply this in Supabase SQL editor (or via migrations if you use them).
--
-- Tables:
--  - billing_customers: maps Supabase user_id -> Dodo customer_id
--  - billing_subscriptions: stores current subscription state per user
--  - billing_credit_periods: monthly credit buckets (even for yearly plans)
--  - billing_webhook_events: idempotency for webhook processing
--
-- RPC:
--  - consume_credits(): atomic decrement with safety checks (used by generation endpoints)

-- Enable needed extension for UUID generation (usually already present in Supabase)
create extension if not exists pgcrypto;

-- 1) Customer mapping
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dodo_customer_id text not null unique,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- 2) Subscription state (we keep a single "current" row per user)
create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null,
  status text not null,
  dodo_subscription_id text,
  dodo_product_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists billing_subscriptions_status_idx on public.billing_subscriptions(status);

-- 3) Monthly credit periods
create table if not exists public.billing_credit_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  credits_total integer not null check (credits_total >= 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start, period_end)
);

create index if not exists billing_credit_periods_user_idx on public.billing_credit_periods(user_id, period_start desc);

-- 4) Webhook idempotency
create table if not exists public.billing_webhook_events (
  event_id text primary key,
  event_type text,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

-- 5) RLS (users can only read their own billing state; server uses service role)
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_credit_periods enable row level security;
alter table public.billing_webhook_events enable row level security;

do $$ begin
  -- billing_customers
  create policy "billing_customers_read_own"
    on public.billing_customers for select
    using (auth.uid() = user_id);

  -- billing_subscriptions
  create policy "billing_subscriptions_read_own"
    on public.billing_subscriptions for select
    using (auth.uid() = user_id);

  -- billing_credit_periods
  create policy "billing_credit_periods_read_own"
    on public.billing_credit_periods for select
    using (auth.uid() = user_id);

  -- billing_webhook_events: no direct user access
exception when duplicate_object then
  null;
end $$;

-- 6) Atomic credit consumption RPC
-- NOTE: This function does NOT create credit periods. It only consumes within the current one.
-- Credit periods are created by webhook/cron when subscription is active.
create or replace function public.consume_credits(p_user_id uuid, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.billing_credit_periods%rowtype;
  v_remaining integer;
  v_status text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select status into v_status
    from public.billing_subscriptions
   where user_id = p_user_id;

  if v_status is distinct from 'active' then
    raise exception 'subscription_not_active';
  end if;

  -- lock the active period row (if present)
  select *
    into v_row
  from public.billing_credit_periods
  where user_id = p_user_id
    and period_start <= v_now
    and period_end > v_now
  order by period_start desc
  limit 1
  for update;

  if not found then
    raise exception 'no_active_credit_period';
  end if;

  v_remaining := v_row.credits_total - v_row.credits_used;
  if v_remaining < p_amount then
    raise exception 'insufficient_credits';
  end if;

  update public.billing_credit_periods
     set credits_used = credits_used + p_amount,
         updated_at = now()
   where id = v_row.id;

  return jsonb_build_object(
    'period_id', v_row.id,
    'user_id', p_user_id,
    'period_start', v_row.period_start,
    'period_end', v_row.period_end,
    'credits_total', v_row.credits_total,
    'credits_used', v_row.credits_used + p_amount,
    'credits_remaining', (v_remaining - p_amount)
  );
end;
$$;

-- Best-effort refund (used when provider call fails after a successful consume)
create or replace function public.refund_credits(p_period_id uuid, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.billing_credit_periods%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select * into v_row
    from public.billing_credit_periods
   where id = p_period_id
   for update;

  if not found then
    raise exception 'period_not_found';
  end if;

  update public.billing_credit_periods
     set credits_used = greatest(0, credits_used - p_amount),
         updated_at = now()
   where id = v_row.id;

  return jsonb_build_object(
    'period_id', v_row.id,
    'user_id', v_row.user_id,
    'credits_total', v_row.credits_total,
    'credits_used', greatest(0, v_row.credits_used - p_amount)
  );
end;
$$;


