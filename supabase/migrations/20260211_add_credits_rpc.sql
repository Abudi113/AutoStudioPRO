-- RPC for atomic credit increments
-- This is used by the Stripe Webhook to securely add credits to a user profile.

CREATE OR REPLACE FUNCTION public.add_purchased_credits(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET credits_purchased = credits_purchased + amount
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
