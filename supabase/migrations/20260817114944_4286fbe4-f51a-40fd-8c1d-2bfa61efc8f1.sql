CREATE TABLE IF NOT EXISTS public.verification_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    email text NOT NULL,
    code_hash text NOT NULL,
    purpose text NOT NULL,
    attempts integer DEFAULT 0,
    expires_at timestamptz NOT NULL,
    verified_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON public.verification_challenges TO authenticated;
GRANT ALL ON public.verification_challenges TO service_role;

ALTER TABLE public.verification_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own challenges"
ON public.verification_challenges FOR SELECT
TO authenticated
USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
