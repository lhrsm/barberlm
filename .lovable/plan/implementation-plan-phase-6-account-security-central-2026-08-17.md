# Implementation Plan - Phase 6: Account Security Central

This phase implements a unified security area for all user types (Clients, Professionals, Staff) to manage their credentials, sessions, and account health, leveraging Supabase Auth and Resend for secure verification.

## User Review Required

> [!IMPORTANT]
> - Email changes will require verification via Resend before taking effect.
> - Password changes will be handled strictly via Supabase Auth.
> - Session management will be implemented based on Supabase's real-time capabilities.

## Proposed Changes

### 1. Database & Security (`Supabase`)
- Ensure `audit_logs` or a similar security activity table is prepared for `login_success`, `password_changed`, etc.
- Verify RLS policies on `profiles` allow users to update their own `display_name` and `email` metadata (if mirrored).

### 2. Server Functions (`src/lib/auth-security.functions.ts`)
- `requestEmailChange`: Validates new email, checks for duplicates, and triggers a verification code via Resend.
- `confirmEmailChange`: Validates the Resend code and updates the Supabase Auth email.
- `updateUserPassword`: Securely updates the user's password using the current session.
- `listUserSessions`: Fetches active sessions/devices for the current user.
- `revokeSession`: Invalidates a specific session.
- `revokeAllOtherSessions`: Invalidates all sessions except the current one.

### 3. UI - Security Central (`src/routes/dashboard.settings.security.tsx` & Portal equivalent)
- **Email Section**: Displays current masked email and "Change Email" modal flow.
- **Password Section**: "Change Password" flow with current/new/confirm fields.
- **Sessions Section**: List of active devices/browsers with "Revoke" options.
- **Security Activity**: A simple timeline of recent security-related events.

### 4. Integration - Resend Templates
- **Email Change Verification**: Branded email with 6-digit code.
- **Security Alert**: (Optional) Notification for new logins or credential changes.

### 5. Shared Components
- `SecurityCentral`: A reusable component base for both the Admin Dashboard and the Customer Portal.

## Technical Details

- **Email Change Flow**:
  1. User enters new email.
  2. System verifies uniqueness.
  3. Resend sends code.
  4. User enters code -> `supabase.auth.updateUser({ email: newEmail })`.
- **Session Revocation**: Uses `supabase.auth.admin.signOut(id)` or scoped session invalidation if available in the client SDK.
- **Rate Limiting**: Implemented in server functions to prevent brute-forcing verification codes or password attempts.

## Acceptance Criteria
- Email can be changed only after verification.
- Password can be changed securely.
- Active sessions are visible and revocable.
- Operation data (appointments, finances) remains untouched.
- Multi-tenant isolation is preserved.
