# Plan: Barbex Appointment Visibility & Forensic Audit

Auditing and fixing the discrepancy between appointment persistence (which blocks availability) and visibility across Admin, Customer, and Professional panels.

## User Review Required

> [!IMPORTANT]
> I have identified that many appointments (including recent test bookings) are being saved with `user_id` set to the **Tenant ID** (Barbearia LM) instead of the **Customer's Auth User ID**. This causes RLS policies that filter by `auth.uid() = user_id` to hide these appointments from the customer portal.

## Technical Details

### 1. Forensic Findings
- **Availability Block**: Works because availability logic queries `appointments` by `status` and `barber_id`, bypassing `user_id` checks.
- **Customer Portal**: Queries `customers` where `user_id = auth.uid()`. It finds the customer record, but the `appointments` for that customer often have `user_id` pointing to the tenant (Admin) instead of the customer's auth user.
- **RLS Leak**: The policy "Users can view their own appointments" uses `auth.uid() = user_id`. If `user_id` is the tenant, the customer cannot see it.

### 2. Architecture Correction
- **Persistence**: Ensure `handleFinalizeBooking` in `src/routes/$slug.tsx` correctly assigns `user_id` from `auth.uid()` during booking.
- **Identity Resolution**: Standardize all panels to use `customer_id` for client visibility and `tenant_id` for admin visibility, rather than relying on the polymorphic `user_id` column for RLS.

### 3. Implementation Steps

#### Phase 1: Database & RLS Hardening
- Audit `appointments` table policies.
- Add/Fix policy: `Customers can view appointments by customer_id` linked to their `profile.id`.
- Add/Fix policy: `Tenant admins can view all appointments in their tenant` regardless of `user_id`.

#### Phase 2: Booking Persistence Fix
- Modify `src/routes/$slug.tsx` to ensure the `user_id` field in `appointments` is populated with the actual `auth_user_id` of the client if available, or stays null/tenant-linked if it's a guest, while ensuring `customer_id` is always the primary link.

#### Phase 3: Dashboard & Portal Trace
- Update `loadPortalData` in `src/routes/$slug.portal.tsx` to include `[PORTAL_APPOINTMENT_TRACE]`.
- Update `fetchTodayAppointments` in `src/routes/dashboard.index.tsx` to include `[ADMIN_APPOINTMENT_TRACE]`.
- Verify joins in `NextAppointmentCard` and `AppointmentsTab` to ensure they don't filter out records with null values in non-essential fields.

#### Phase 4: Data Sync
- Run a migration to backfill/correct `user_id` or `customer_id` links for the test accounts identified (Louis Menezes).
