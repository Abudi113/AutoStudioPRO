-- Migration: 20260210_refill_credits.sql
-- Description: Automated monthly credit refills for subscription tiers

-- 1. Create a function to refill credits based on subscription tier
CREATE OR REPLACE FUNCTION refill_monthly_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    profile_record RECORD;
    refill_amount INTEGER;
BEGIN
    FOR profile_record IN SELECT * FROM profiles WHERE subscription_tier != 'free' LOOP
        -- Define refill amounts based on tier
        CASE profile_record.subscription_tier
            WHEN 'pro' THEN refill_amount := 150;
            WHEN 'agency' THEN refill_amount := 750;
            WHEN 'starter' THEN refill_amount := 50;
            ELSE refill_amount := 0;
        END CASE;

        -- We rollover monthly credits to vault before resetting (Pro/Agency benefit)
        UPDATE profiles
        SET 
            credits_vault = credits_vault + credits_monthly,
            credits_monthly = refill_amount,
            last_refill_date = NOW()
        WHERE id = profile_record.id;
    END LOOP;
END;
$$;

-- 2. Note for User: 
-- To automate this, go to Supabase -> Database -> Cron (pg_cron) and add:
-- select refill_monthly_credits(); 
-- Schedule: 0 0 1 * * (Every 1st of the month at 00:00)

-- 3. Trigger for individual manual refill check (Optional / Logic for backend)
-- This ensures if a user logs in and its been > 30 days since last refill, we check.
-- But Cron is more reliable for business accounting.
