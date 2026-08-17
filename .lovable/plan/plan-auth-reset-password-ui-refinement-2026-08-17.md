# Plan: Auth, Reset Password & UI Refinement

Finalizing the Barbex identity and security layer by resolving login failures, recovery flow redirects, and standardizing the premium UI.

## User Review Required

> [!IMPORTANT]
> The recovery link currently in your e-mail might still point to the old location until new emails are sent after this deployment.

- Does the Barbex logo at 220px (Desktop) feel correct, or should it be even larger?
- For the phone mask, I will assume a Brazilian standard (+55) by default if no country code is provided.

## Proposed Changes

### Auth & Security
- **Fix Login Logic**: Update `clientLogin` in `src/lib/auth-client.functions.ts` to definitively handle normalized identifiers (lowercase email, E.164 phone).
- **Hardened Phone Normalization**: Update `src/utils/phone.ts` to be more aggressive in adding `+55` and fixing common Brazilian formatting issues (9th digit).
- **Recovery Redirect**: Fix `requestPasswordReset` to point to `/auth/reset-password`.
- **Reset Password Rota**: Refine `src/routes/auth.reset-password.tsx` to ensure it correctly validates the Supabase recovery session.

### UI/UX & Branding
- **Logo Centralization**: Update `src/routes/auth.tsx` to use a flex-col layout that perfectly aligns the `BarbexLogo` with the card's axis.
- **Logo Resizing**: Increase `BarbexLogo` to `220px` (desktop) and remove any redundant text labels.
- **Standardized Inputs**: Ensure `src/components/ui/input.tsx` enforces a white background even during focus and browser autofill.
- **Recovery Success Modal**: Replace the simple toast/view with a premium modal featuring the `mail-check` icon and gold borders.

### Integration
- **Supabase Auth Repair**: Maintain the background routine that fixes missing phone numbers in `auth.users` if found in the `customers` table.

## Technical Details

- **Identifier Detection**: Uses `@` symbol to toggle between email and phone logic.
- **Masking**: Implements a visual mask in the UI while sending only digits to the backend.
- **Autofill Handling**: CSS overrides for `:-webkit-autofill` to prevent "browser blue/yellow" backgrounds on inputs.
- **TanStack Router**: All route changes will be done in `.tsx` files to preserve the generated route tree.
