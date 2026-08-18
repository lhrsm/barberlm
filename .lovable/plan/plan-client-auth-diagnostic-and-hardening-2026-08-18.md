# Plan - Client Auth Diagnostic and Hardening

The administrative login is stable and working for `louisdabahia@gmail.com`. The current task is to diagnose and fix the client authentication flow, specifically for `louishenrique19@hotmail.com` (Client 1), while ensuring zero impact on administrative identity.

## Diagnostic & Audit (Step 1-12)
- **Identity Integrity Check**: Audit Supabase Auth for `louishenrique19@hotmail.com` to verify `id`, `email_confirmed_at`, and `password` credentials.
- **Credential Verification**: Perform a direct `signInWithPassword` test for Client 1 via a temporary diagnostic script to isolate credentials from the frontend application logic.
- **Recovery Session Audit**: Verify that the password recovery flow correctly targets `997746ee-723f-40e4-a6c6-5359eddd2a98` and does not bleed into the admin session.
- **Duplicate Detection**: Search for duplicate Auth Users associated with the same email or phone number.

## Implementation & Hardening (Step 13-22)
- **UI Error Standardization**: Standardize `ClientLoginForm.tsx` to show "E-mail ou senha inválidos" instead of raw technical errors while preserving technical logs.
- **Component Isolation**: Audit the "ENTRAR COMO CLIENTE" button to ensure it strictly calls the client auth flow and not administrative staff resolvers.
- **Auth Provider Resilience**: Verify `useAuth.ts` correctly handles client profile hydration and tenant-based redirection to the correct portal slug.
- **Cross-Contamination Safeguards**: Implement explicit checks to ensure client auth operations never modify the admin account.

## Technical Requirements
- Never use `supabase.auth.updateUser` for cross-user operations.
- Ensure `redirectTo` in `resetPasswordForEmail` explicitly targets `/auth/reset-password`.
- Verify the returned `user.id` matches the `customers.auth_user_id` record.
