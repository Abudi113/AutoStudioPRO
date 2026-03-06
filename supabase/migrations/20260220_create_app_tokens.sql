-- App Tokens: Allow website users to generate a token for mobile app login
-- Each user can have exactly one active token at a time.

CREATE TABLE IF NOT EXISTS public.app_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_active_token_per_user UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.app_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "Users can view own tokens"
    ON public.app_tokens FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can create own tokens"
    ON public.app_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update (regenerate) their own tokens
CREATE POLICY "Users can update own tokens"
    ON public.app_tokens FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete own tokens"
    ON public.app_tokens FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can read all tokens (for the exchange edge function)
-- The edge function will use the service_role key which bypasses RLS
