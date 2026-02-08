
-- Migration: 20260209_extended_credits
-- Description: Adds advanced credit pooling (Monthly, Purchased, Vault) and Subscription tracking.

-- 1. Update profiles table with specific credit pools
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credits_monthly INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_purchased INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_vault INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_purchased_expiry TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS last_refill_date TIMESTAMPTZ;

-- 2. Enhanced credit deduction function (Atomic & Hierarchical)
-- Logic Order: Monthly -> Purchased -> Vault
CREATE OR REPLACE FUNCTION public.deduct_credits(user_id UUID)
RETURNS JSON AS $$
DECLARE
    p_rec RECORD;
    deducted BOOLEAN := FALSE;
    pool_used TEXT := 'none';
BEGIN
    -- Select the user profile with a row lock
    SELECT * INTO p_rec FROM public.profiles WHERE id = user_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- A. Check Monthly Credits FIRST (These reset soonest)
    IF p_rec.credits_monthly > 0 THEN
        UPDATE public.profiles SET credits_monthly = credits_monthly - 1 WHERE id = user_id;
        deducted := TRUE;
        pool_used := 'monthly';
    
    -- B. Check Purchased Credits SECOND (3-month expiry)
    ELSIF p_rec.credits_purchased > 0 AND (p_rec.credits_purchased_expiry IS NULL OR p_rec.credits_purchased_expiry > now()) THEN
        UPDATE public.profiles SET credits_purchased = credits_purchased - 1 WHERE id = user_id;
        deducted := TRUE;
        pool_used := 'purchased';

    -- C. Check Vault Credits THIRD (Permanent storage)
    ELSIF p_rec.credits_vault > 0 THEN
        UPDATE public.profiles SET credits_vault = credits_vault - 1 WHERE id = user_id;
        deducted := TRUE;
        pool_used := 'vault';
    END IF;

    IF deducted THEN
        RETURN json_build_object('success', true, 'pool', pool_used);
    ELSE
        RETURN json_build_object('success', false, 'error', 'Insufficient credits');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to move credits to Vault (Max 100)
CREATE OR REPLACE FUNCTION public.move_to_vault(user_id UUID, amount INTEGER)
RETURNS JSON AS $$
DECLARE
    current_vault INTEGER;
    room_in_vault INTEGER;
    to_move INTEGER;
BEGIN
    SELECT credits_vault INTO current_vault FROM public.profiles WHERE id = user_id FOR UPDATE;
    
    room_in_vault := 100 - current_vault;
    IF room_in_vault <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Vault is full');
    END IF;

    to_move := LEAST(amount, room_in_vault);
    
    UPDATE public.profiles 
    SET credits_vault = credits_vault + to_move,
        -- Deduct from whatever pool the user specifically wanted to save? 
        -- Generally, users move Purchased credits to Vault if they are about to expire.
        -- For now, we'll assume this is called on specific credits.
        credits_purchased = GREATEST(0, credits_purchased - to_move)
    WHERE id = user_id;

    RETURN json_build_object('success', true, 'moved', to_move);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Initial Signup Polish (Ensure 5 free credits go to 'monthly' or 'purchased' as desired)
-- Let's put initial 5 into 'credits_purchased' with NO expiry or 10 years to mimic permanent free ones.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, credits_purchased, credits_purchased_expiry)
  VALUES (new.id, new.email, 5, now() + interval '10 years');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
