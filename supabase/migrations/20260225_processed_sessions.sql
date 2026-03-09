-- Table to prevent double-granting credits for the same Stripe session
CREATE TABLE IF NOT EXISTS public.processed_sessions (
  session_id       TEXT PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credits_granted  INTEGER NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Only the service role (edge functions) can write; users can't tamper
ALTER TABLE public.processed_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.processed_sessions
  USING (false)
  WITH CHECK (false);
