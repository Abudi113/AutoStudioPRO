-- COMPLETE BACKEND SETUP FOR AUTOSTUDIO PRO AI
-- Run this in the Supabase SQL Editor to set up your database tables and functions.

-- 1. Create PROFILES table (Stores user credits & subscription info)
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  credits_monthly integer default 0,
  credits_purchased integer default 5, -- Give 5 free credits on signup
  credits_vault integer default 0,
  credits_purchased_expiry timestamp with time zone default (now() + interval '10 years'),
  subscription_tier text default 'free',
  last_refill_date timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  primary key (id)
);

-- 2. Enable Security (Row Level Security)
alter table public.profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can update their own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 3. Auto-create Profile on Signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, credits_purchased, credits_purchased_expiry)
  values (new.id, new.email, 5, now() + interval '10 years');
  return new;
end;
$$;

-- Trigger to run every time a user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Credit Deduction Logic (Monthly -> Purchased -> Vault)
-- This function is called by the frontend to safely deduct a credit
create or replace function public.deduct_credits()
returns json 
language plpgsql 
security definer
as $$
declare
    user_id uuid;
    current_credits integer;
    p_rec record;
    deducted boolean := false;
    pool_used text := 'none';
begin
    -- Get current user ID
    user_id := auth.uid();
    if user_id is null then
        return json_build_object('success', false, 'error', 'Not authenticated');
    end if;

    -- Select the user profile with a row lock
    select * into p_rec from public.profiles where id = user_id for update;

    if not found then
        return json_build_object('success', false, 'error', 'Profile not found');
    end if;

    -- A. Check Monthly Credits FIRST
    if p_rec.credits_monthly > 0 then
        update public.profiles set credits_monthly = p_rec.credits_monthly - 1 where id = user_id;
        deducted := true;
        pool_used := 'monthly';
    
    -- B. Check Purchased Credits SECOND
    elsif p_rec.credits_purchased > 0 and (p_rec.credits_purchased_expiry is null or p_rec.credits_purchased_expiry > now()) then
        update public.profiles set credits_purchased = p_rec.credits_purchased - 1 where id = user_id;
        deducted := true;
        pool_used := 'purchased';

    -- C. Check Vault Credits THIRD
    elsif p_rec.credits_vault > 0 then
        update public.profiles set credits_vault = p_rec.credits_vault - 1 where id = user_id;
        deducted := true;
        pool_used := 'vault';
    end if;

    if deducted then
        return json_build_object('success', true, 'pool', pool_used);
    else
        return json_build_object('success', false, 'error', 'Insufficient credits');
    end if;
end;
$$;

-- 5. Vault Logic (Move credits to safe storage)
create or replace function public.move_to_vault(amount integer)
returns json 
language plpgsql 
security definer
as $$
declare
    user_id uuid;
    current_vault integer;
    room_in_vault integer;
    to_move integer;
begin
    user_id := auth.uid();
    if user_id is null then return json_build_object('success', false); end if;

    select credits_vault into current_vault from public.profiles where id = user_id for update;
    
    room_in_vault := 100 - current_vault; -- Max vault size 100
    if room_in_vault <= 0 then
        return json_build_object('success', false, 'error', 'Vault is full');
    end if;

    -- NOTE: In this simplified version, we just assume movement from 'credits_purchased'
    -- You might want to pass 'source_pool' as an argument in a more advanced version
    to_move := least(amount, room_in_vault);
    
    update public.profiles 
    set credits_vault = credits_vault + to_move,
        credits_purchased = greatest(0, credits_purchased - to_move)
    where id = user_id;

    return json_build_object('success', true, 'moved', to_move);
end;
$$;

-- 6. Move FROM Vault Logic
create or replace function public.move_from_vault(amount integer)
returns json 
language plpgsql 
security definer
as $$
declare
    user_id uuid;
    current_vault integer;
    to_move integer;
begin
    user_id := auth.uid();
    if user_id is null then return json_build_object('success', false); end if;

    select credits_vault into current_vault from public.profiles where id = user_id for update;
    
    to_move := least(amount, current_vault);
    
    update public.profiles 
    set credits_vault = credits_vault - to_move,
        credits_purchased = credits_purchased + to_move
    where id = user_id;

    return json_build_object('success', true, 'moved', to_move);
end;
$$;

-- 7. Monthly Refill Logic (For Cron Jobs)
create or replace function public.refill_monthly_credits()
returns void
language plpgsql
security definer
as $$
declare
    profile_record record;
    refill_amount integer;
begin
    for profile_record in select * from public.profiles where subscription_tier != 'free' loop
        -- Define refill amounts based on tier
        case profile_record.subscription_tier
            when 'pro' then refill_amount := 150;
            when 'agency' then refill_amount := 750;
            when 'starter' then refill_amount := 50;
            else refill_amount := 0;
        end case;

        -- Rollover monthly credits to vault before resetting
        update public.profiles
        set 
            credits_vault = credits_vault + credits_monthly,
            credits_monthly = refill_amount,
            last_refill_date = now()
        where id = profile_record.id;
    end loop;
end;
$$;
