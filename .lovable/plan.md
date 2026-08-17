# Implementation Plan - Customer Portal Authentication (Phase 3)

This plan consolidates the customer authentication flow, allowing login via phone or email and implementing a secure password recovery system.

## Proposed Changes

### 1. Identity & Auth Logic (Backend)
- **src/lib/auth-client.functions.ts**:
  - Implement `validateResetToken` server function to check Supabase reset tokens.
  - Implement `updatePassword` server function using the reset token/session.
- **src/lib/auth-verification.functions.ts**:
  - Update `finalizeAuthSetup` to ensure it properly links the `auth.users` account with the existing `clients` record and sets `auth_setup_status = 'completed'`.

### 2. Password Recovery (Frontend)
- **src/routes/auth.reset-password.tsx**:
    - Create a new route for the password reset flow.
    - Implement a "Create New Password" form following the Gold Premium design.
    - Handle success and expired token states.

### 3. Authentication UI Enhancements
- **src/components/public/auth/ClientLoginForm.tsx**:
  - Add a "Remember Me" toggle (Manter conectado).
  - Improve error handling to be generic (security best practice).
  - Ensure `autocomplete` attributes are correctly set.
- **src/components/public/booking/BookingAuthStep.tsx**:
  - Refine the migration flow when accessed from the login screen.

### 4. Route Guards & Navigation
- **src/routes/$slug.portal.tsx**:
  - Strengthen `CustomerPortalGuard` to verify tenant association.
  - Implement "Post-login redirect" to return users to their intended page.

## Technical Details

- **Supabase Auth**: Use standard `signInWithPassword`, `resetPasswordForEmail`, and `updateUser` methods.
- **Identifier Normalization**: Use the existing `normalizeIdentifier` utility to handle both e-mail and phone inputs in a single field.
- **Rate Limiting**: Supabase Auth has built-in rate limits for login and password resets. We will rely on these and display appropriate error messages.
- **Design System**: Maintain the "Gold Premium" aesthetic (Black, Gold, circular logos, rounded corners).

## Verification Plan

### Automated Tests
- Run `tsgo` for type checking.
- Execute Playwright scripts to verify:
    - Login with email/phone + password.
    - Password reset request flow.
    - Legacy migration flow via login.
    - Route protection (guards).

### Manual Verification
- Test password reset link from a real email (Resend simulation).
- Verify mobile responsiveness of the new login and reset pages.
- Confirm session cleanup on logout to prevent cross-account data leakage.
