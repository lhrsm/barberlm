# Implementation Plan - Phase 4: Internal User Management

This phase implements a robust system for managing internal users (Managers, Receptionists, etc.), separating the concept of a "System User" from a "Professional". It includes invitation flows via Resend, role-based access control (RBAC), and membership management.

## User Review Required

> [!IMPORTANT]
> - We are using the existing `tenant_memberships` table and `app_role` enum.
> - A new table `user_invitations` will be created to manage the invitation flow.
> - The Resend API key already exists in the environment from Phase 2.

## Proposed Changes

### 1. Database & Security
- Create `user_invitations` table: `id, tenant_id, email, phone, role, professional_id, token_hash, status (pending, accepted, expired, revoked), expires_at, invited_by`.
- Enable RLS on `user_invitations` and grant permissions.
- Ensure `profiles` and `tenant_memberships` have proper RLS for multi-tenant isolation.

### 2. Server Functions (`src/lib/team.functions.ts`)
- `inviteUser`: Validates input, generates token, creates invitation, and sends email via Resend.
- `acceptInvitation`: Validates token, creates/links Auth user, activates membership, and assigns role.
- `updateUserRole`: Allows admins to change a user's role.
- `setUserStatus`: Handles blocking/reactivating users.
- `removeUserFromTenant`: Revokes membership while preserving data history.

### 3. UI - Team Management (`src/routes/dashboard.team.tsx`)
- Create a new "Usuários e Permissões" page.
- Dashboard with KPIs: Active Users, Pending Invites, Blocked Users.
- User Table: Avatar, Name, Email, Role, Professional Link, Status, Actions.
- Invitation Table: Track pending invites with "Resend" and "Revoke" actions.

### 4. UI - Invitation Acceptance (`src/routes/invite.$token.tsx`)
- Public route to accept invitations.
- Display barbershop name and role being offered.
- Secure password creation flow.

### 5. Authentication & Navigation
- Update `AppLayout.tsx` to include the "Equipe" menu item (if not already present or refined).
- Implement role-based redirects: Receptionist -> Command Center, etc.
- Add `TeamProvider` or update `useTenant` to handle membership-specific permissions.

## Technical Details

- **Database**:
  ```sql
  CREATE TABLE public.user_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    email text NOT NULL,
    phone text,
    role public.app_role NOT NULL,
    professional_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
    token_hash text NOT NULL,
    status text DEFAULT 'pending',
    expires_at timestamptz NOT NULL,
    invited_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  GRANT SELECT, INSERT, UPDATE ON public.user_invitations TO authenticated;
  GRANT ALL ON public.user_invitations TO service_role;
  ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
  ```
- **Email Templates**: Premium branding using Resend, with clear CTAs for each role.
- **Roles Mapping**:
  - `admin/tenant_admin`: Full access.
  - `manager`: Dashboard, Command Center, CRM, Team Management.
  - `receptionist`: Command Center, Agenda, Customers, Payments.
  - `financial`: Finances, Commissions, Reports.
  - `professional`: Own agenda, individual stats.
