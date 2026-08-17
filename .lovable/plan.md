# Plan: Fix Client Login, Input Styles, and Brand Identity

## Phase 1: Authentication Hardening (Critical)
1.  **Investigation Results**:
    *   Test user `louishenrique19@hotmail.com` exists in `customers` (linked to `997746ee...`) and `profiles` (ID `997746ee...`).
    *   Auth User was created successfully (verification challenge verified at 15:25 UTC).
    *   `clientLogin` uses `supabase.auth.signInWithPassword` which requires valid credentials in `auth.users`.
    *   **Potential Issue**: The `normalizeIdentifier` and `normalizePhone` functions might be causing mismatches if the phone stored in `auth.users` differs from the operational phone in `customers`.
2.  **Auth Fix**:
    *   Audit `finalizeAuthSetup` to ensure `auth.admin.createUser` is correctly setting the email and password.
    *   Audit `clientLogin` to improve error reporting (for internal debug) without exposing sensitive info.
    *   Ensure phone login attempts use the exact normalized format `55DD9NNNNNNNN`.
3.  **Tenant Resolution**:
    *   Ensure the `tenant_id` is correctly resolved after login to redirect to the correct portal.

## Phase 2: UI/UX Standardization (Visual)
1.  **Logo Update**:
    *   Replace generic icons in `src/routes/auth.tsx` with `BarbexLogo`.
    *   Ensure consistent sizing (100-140px desktop, 80-110px mobile).
2.  **Input Component Refactoring**:
    *   Update `src/components/ui/input.tsx` to use a light-themed default background that is consistent with the "White/Gold" modal theme.
    *   Ensure `focus` states use the Gold border/ring without changing the background to dark.
    *   Fix `InputOTP` slots to follow the same light theme.
    *   Handle `:-webkit-autofill` styles to prevent browser-default yellow/dark backgrounds.
3.  **Component Scoped Overrides**:
    *   In `ClientLoginForm.tsx` and `BookingAuthStep.tsx`, ensure all `Input` instances have the correct classes to maintain visibility (dark text on light background).

## Phase 3: Testing & Validation
1.  **Login Flow**: Test Email + Password and Phone + Password for the same account.
2.  **Visual Regression**: Check modal inputs on mobile and desktop.
3.  **Brand Check**: Verify logo placement and responsiveness.

## Technical Details
*   **Normalizer**: `src/utils/phone.ts` (ensure it's used everywhere).
*   **Auth Functions**: `src/lib/auth-client.functions.ts` and `src/lib/auth-verification.functions.ts`.
*   **Components**: `src/components/public/auth/ClientLoginForm.tsx`, `src/components/public/booking/BookingAuthStep.tsx`, `src/components/ui/input.tsx`.
