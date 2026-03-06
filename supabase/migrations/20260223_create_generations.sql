-- Stores every AI-generated image result, linked to the user who created it.
-- The edge function inserts rows here (using service role key, which bypasses RLS).
-- The app reads from this table using the anon key (restricted by RLS to own rows).

CREATE TABLE IF NOT EXISTS public.generations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    result_url  TEXT NOT NULL,       -- public URL of the result image in Supabase Storage
    angle       TEXT,                -- e.g. 'front', 'rear_left_34', 'interior_driver'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Users can only read their own generated images
CREATE POLICY "Users can view own generations"
    ON public.generations
    FOR SELECT
    USING (auth.uid() = user_id);

-- The edge function uses the service role key which bypasses RLS for INSERT.
-- No anon/authenticated INSERT policy is needed for security.
