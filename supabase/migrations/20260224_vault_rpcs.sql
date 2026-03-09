-- ============================================================
-- Credit Vault System — Full Backend Setup
-- Run this in Supabase Dashboard › SQL Editor
-- ============================================================

-- 1. Ensure all credit columns exist on profiles
-- (safe to run even if columns already exist)
alter table public.profiles
  add column if not exists credits_monthly       int not null default 0,
  add column if not exists credits_purchased     int not null default 0,
  add column if not exists credits_vault         int not null default 0,
  add column if not exists credits_purchased_expiry timestamptz;


-- ============================================================
-- 2. deduct_credits()
-- Called after each successful image generation.
-- Deducts 1 credit from monthly pool first, then purchased.
-- Vault credits are NEVER auto-deducted (they're locked).
-- Returns: { success: bool, pool: "monthly"|"purchased"|null }
-- ============================================================
drop function if exists public.deduct_credits();
create function public.deduct_credits()
returns jsonb language plpgsql security definer as $$
declare
  v_monthly   int;
  v_purchased int;
  v_pool      text;
begin
  select credits_monthly, credits_purchased
  into   v_monthly, v_purchased
  from   public.profiles
  where  id = auth.uid()
  for update;

  if v_monthly > 0 then
    update public.profiles
    set    credits_monthly = credits_monthly - 1
    where  id = auth.uid();
    v_pool := 'monthly';

  elsif v_purchased > 0 then
    update public.profiles
    set    credits_purchased = credits_purchased - 1
    where  id = auth.uid();
    v_pool := 'purchased';

  else
    return jsonb_build_object('success', false, 'pool', null);
  end if;

  return jsonb_build_object('success', true, 'pool', v_pool);
end;
$$;


-- ============================================================
-- 3. move_to_vault(amount int)
-- Move credits from usable pool → vault (max 20 in vault).
-- Deducts from monthly credits first, then purchased.
-- Returns: true on success, false on failure
-- ============================================================
drop function if exists public.move_to_vault(int);
create function public.move_to_vault(amount int)
returns boolean language plpgsql security definer as $$
declare
  v_monthly   int;
  v_purchased int;
  v_vault     int;
  v_remaining int;
begin
  select credits_monthly, credits_purchased, credits_vault
  into   v_monthly, v_purchased, v_vault
  from   public.profiles
  where  id = auth.uid()
  for update;

  -- Hard cap: vault holds max 20
  if v_vault + amount > 20 then
    return false;
  end if;

  -- Must have enough usable credits
  if v_monthly + v_purchased < amount then
    return false;
  end if;

  v_remaining := amount;

  if v_monthly >= v_remaining then
    -- Monthly alone covers the amount
    update public.profiles
    set    credits_monthly = credits_monthly - v_remaining,
           credits_vault   = credits_vault   + amount
    where  id = auth.uid();
  else
    -- Use all monthly, rest from purchased
    update public.profiles
    set    credits_monthly   = 0,
           credits_purchased = credits_purchased - (v_remaining - v_monthly),
           credits_vault     = credits_vault     + amount
    where  id = auth.uid();
  end if;

  return true;
end;
$$;


-- ============================================================
-- 4. move_from_vault(amount int)
-- Retrieve credits back from vault → purchased pool.
-- Returns: true on success, false if vault doesn't have enough
-- ============================================================
drop function if exists public.move_from_vault(int);
create function public.move_from_vault(amount int)
returns boolean language plpgsql security definer as $$
declare
  v_vault int;
begin
  select credits_vault
  into   v_vault
  from   public.profiles
  where  id = auth.uid()
  for update;

  if v_vault < amount then
    return false;
  end if;

  update public.profiles
  set    credits_vault     = credits_vault     - amount,
         credits_purchased = credits_purchased + amount
  where  id = auth.uid();

  return true;
end;
$$;


-- ============================================================
-- 5. add_purchased_credits(p_user_id, p_amount) — already exists
-- Recreating here for completeness (safe to re-run)
-- ============================================================
drop function if exists public.add_purchased_credits(uuid, int);
create function public.add_purchased_credits(p_user_id uuid, p_amount int)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set    credits_purchased = coalesce(credits_purchased, 0) + p_amount
  where  id = p_user_id;
end;
$$;


-- ============================================================
-- 6. Grant execute permissions to authenticated users
-- ============================================================
grant execute on function public.deduct_credits()        to authenticated;
grant execute on function public.move_to_vault(int)      to authenticated;
grant execute on function public.move_from_vault(int)    to authenticated;
grant execute on function public.add_purchased_credits(uuid, int) to service_role;
