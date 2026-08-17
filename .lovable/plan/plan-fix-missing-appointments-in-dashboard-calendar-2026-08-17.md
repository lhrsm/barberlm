# Plan - Fix Missing Appointments in Dashboard/Calendar

The investigation revealed that appointments are being successfully created in the database but are not appearing in administrative views (Dashboard and Calendar). The primary cause is a mismatch in how `tenant_id` is handled and filtered, combined with potential RLS limitations.

## Proposed Changes

### Database & RLS
- Update the "Tenant can view own appointments" RLS policy to ensure it correctly handles the admin's `profile.id` as the `tenant_id` even when `profile.tenant_id` is null.
- Add an explicit `GRANT SELECT` on `appointments` to `authenticated` if missing or restricted.

### Frontend - Public Booking (`src/routes/$slug.tsx`)
- Audit the `handleFinalizeBooking` payload to ensure `tenant_id` is explicitly set to the `tenant.id` (which is the admin's profile ID).
- Verify that the `status` is correctly set to 'confirmed' and that this status is recognized by the UI.

### Frontend - Dashboard & Calendar
- Refine the filtering logic in `src/routes/dashboard.index.tsx` and `src/routes/calendar.tsx` to ensure it uses the correct `tenant_id` from the context/hook.
- Ensure 'confirmed' status is explicitly included in the fetch filters if RLS isn't already handling it.

## Technical Details
- **RLS Fix**: `ALTER POLICY "Tenant can view own appointments" ON public.appointments USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()));`
- **Dashboard Filter**: Update `fetchTodayAppointments` to ensure it doesn't accidentally exclude 'confirmed' appointments due to status mapping.
