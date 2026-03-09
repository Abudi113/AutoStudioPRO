-- RPC to atomically deduct 1 credit from the authenticated user's profile.
-- Returns JSON { success: true } if deducted, { success: false } if insufficient credits.

CREATE OR REPLACE FUNCTION public.deduct_credits()
RETURNS JSON AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT credits_purchased
    INTO current_credits
    FROM public.profiles
   WHERE id = auth.uid()
     FOR UPDATE;

  IF current_credits IS NULL OR current_credits < 1 THEN
    RETURN json_build_object('success', false, 'reason', 'insufficient_credits');
  END IF;

  UPDATE public.profiles
     SET credits_purchased = credits_purchased - 1
   WHERE id = auth.uid();

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.deduct_credits() TO authenticated;
