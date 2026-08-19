# Plan: Forensic Audit & Dashboard/Portal Restoration

This plan addresses the hydration loops in the Admin Dashboard and the identity resolution failures in the Client Portal, ensuring consistent appointment visibility across all interfaces.

## User Review Required

> [!IMPORTANT]
> The fixes involve decoupling background data refreshes from global UI loading states. This means the Dashboard will no longer "flash" or reset to a loading screen when a new appointment is booked.

- **Admin Dashboard**: Refactoring to separate initial boot from background synchronization.
- **Client Portal**: Implementing a robust state machine for tenant and customer resolution.
- **Security**: Verifying RLS policies to ensure authenticated clients can see their own history without multi-tenant leakage.

## Proposed Changes

### Admin Dashboard (`src/routes/dashboard.index.tsx`)
- Implement `[DASHBOARD_LOADING_TRACE]` to log state transitions.
- Introduce `isInitialBoot` state to handle the first load separately from background refreshes.
- Refactor fetchers (`fetchStats`, `fetchTodayAppointments`) to use `try/catch/finally` ensuring loading states are always cleared.
- Update Realtime listener to trigger background refreshes without hitting the global loading skeleton.
- Decouple BI/Stats loading from core Operational (Appointments) loading.

### Client Portal (`src/routes/$slug.portal.tsx`)
- Implement explicit `PortalState`: `INITIALIZING`, `AUTH_RESOLVED`, `TENANT_RESOLVED`, `CUSTOMER_RESOLVED`, `DATA_READY`, `ERROR`, `NOT_FOUND`.
- Add `[PORTAL_RESOLUTION_TRACE]` for forensic debugging of identity resolution.
- Refactor `loadPortalData` to follow the state machine strictly, avoiding premature "Perfil não encontrado" flashes.
- Harden phone-based fallback to avoid multi-tenant collisions (strictly scoped to `tenant_id`).
- Ensure `appointments` query uses `customer_id` and `tenant_id` consistently.

### Identity & Persistence
- Audit `customers` table RLS to ensure `user_id` linkage works for authenticated sessions.
- Audit `appointments` table RLS to ensure visibility for both `tenant_admin` and `client`.
- Add `[APPOINTMENT_VISIBILITY_TRACE]` to track appointment visibility across interfaces.

## Technical Details
- **Dashboard State Management**: Transition from monolithic `loading` to granular flags (`isStatsRefreshing`, `isAppointmentsRefreshing`).
- **Portal Machine**:
  1. `supabase.auth.getSession()` -> `AUTH_RESOLVED`
  2. Slug lookup -> `TENANT_RESOLVED`
  3. `customers` lookup (user_id OR phone) -> `CUSTOMER_RESOLVED`
  4. Parallel data fetch -> `DATA_READY`
- **RLS Verification**: Ensure policies for `appointments` allow `authenticated` users where `customer_id` matches their profile's customer record.

## Verification Plan

### Automated Tests
- None available for this environment, relying on manual verification and trace logs.

### Manual Verification
1. **Admin Dashboard**:
   - Open Dashboard (READY).
   - Simulate/Perform booking.
   - Verify notification arrives and Dashboard updates *without* showing the global loading skeleton.
2. **Client Portal**:
   - Access `/$slug/portal`.
   - Verify transition: "Autenticando..." -> "Sincronizando..." -> Home View.
   - Verify history shows old and new appointments.
3. **F5 Resilience**:
   - Refresh both pages and ensure they recover without infinite loops.
