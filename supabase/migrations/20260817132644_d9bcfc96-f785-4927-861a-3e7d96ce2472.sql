CREATE TABLE public.user_mfa_backup_codes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    code_hash text not null,
    used_at timestamptz,
    created_at timestamptz default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_mfa_backup_codes TO authenticated;
GRANT ALL ON public.user_mfa_backup_codes TO service_role;

ALTER TABLE public.user_mfa_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own backup codes"
ON public.user_mfa_backup_codes
FOR ALL
TO authenticated
USING (auth.uid() = user_id);
